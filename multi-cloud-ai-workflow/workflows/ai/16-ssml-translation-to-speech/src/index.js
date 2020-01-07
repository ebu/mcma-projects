//"use strict";
const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider, NotificationEndpoint, JobParameterBag, AIJob, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FolderLocator, AwsS3FileLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-16-ssml-translation-to-speech", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "AWSSsmlTextToSpeech";
const JOB_RESULTS_PREFIX = "AIResults/ssmlTextToSpeech/";

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    const logger = loggerProvider.get(event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);
        logger.info(TempBucket, ActivityCallbackUrl, ActivityArn);

        // send update notification
        try {
            event.parallelProgress = { "ssml-text-to-speech": 60 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get activity task
        let data = await StepFunctions.getActivityTask({ activityArn: ActivityArn }).promise();

        let taskToken = data.taskToken;
        if (!taskToken) {
            throw new Exception("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultanously.
        event = JSON.parse(data.input);

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new Exception("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        // identify event related bmContent
        let bmContent = await resourceManager.get(event.input.bmContent);

        // get ssml translation from bmContent
        if (!bmContent.awsAiMetadata ||
            !bmContent.awsAiMetadata.transcription ||
            !bmContent.awsAiMetadata.transcription.ssmlTranslation) {
            throw new Exception("Missing ssml translation on BMContent");
        }
        logger.info(bmContent.awsAiMetadata.transcription.ssmlTranslation);
        let s3Bucket = TempBucket;
        let s3Key = "AiInput/ssmlTranslation.txt";
        // get ssml translation from bmContent and load in a file in tempBucket
        let s3Params = {
            Bucket: s3Bucket,
            Key: s3Key,
            Body: bmContent.awsAiMetadata.transcription.ssmlTranslation
        };
        await S3.putObject(s3Params).promise();
        // logger.info(bmContent.awsAiMetadata.transcription.tokenizedTranslation);

        // HARD ENCODE SSML and Save as ssmlTranslationSynched.txt in tempBucket
//    let s3BucketSynched = TempBucket;
//    let s3KeySynched = "AiInput/ssmlTranslationSynched.txt";


        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("NotificationUrl:", notificationUrl);

        // creating Polly job for text to speech in French using ssml translation data
        // change inputFile from ssmlTranslation.txt (s3Bucket and s3Key) coming from the workflow
        // with ssmlTranslationSynched.txt (s3BucketSynched and s3KeySynched) hard encoded
        let job = new AIJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    awsS3Bucket: s3Bucket,
                    awsS3Key: s3Key
                }),
                voiceId: "Lea",
                outputLocation: new AwsS3FolderLocator({
                    awsS3Bucket: TempBucket,
                    awsS3KeyPrefix: JOB_RESULTS_PREFIX
                })
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            }),
            tracker: event.tracker,
        });

        // posting the job to the job repository
        job = await resourceManager.create(job);
    } catch (error) {
        logger.error("Failed to do SSML translation to speech");
        logger.error(error.toString());
        throw new Exception("Failed to do SSML translation to speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
