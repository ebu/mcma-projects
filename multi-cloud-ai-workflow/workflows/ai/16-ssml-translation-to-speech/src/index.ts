import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AIJob, EnvironmentVariableProvider, JobBaseProperties, JobParameterBag, JobProfile, McmaException, NotificationEndpoint } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent } from "@local/common";

const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-16-ssml-translation-to-speech", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "AWSSsmlTextToSpeech";
const JOB_RESULTS_PREFIX = "AIResults/ssmlTextToSpeech/";

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
} & JobBaseProperties;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
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
            throw new McmaException("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        // identify event related bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // get ssml translation from bmContent
        if (!bmContent.awsAiMetadata ||
            !bmContent.awsAiMetadata.transcription ||
            !bmContent.awsAiMetadata.transcription.ssmlTranslation) {
            throw new McmaException("Missing ssml translation on BMContent");
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
        throw new McmaException("Failed to do SSML translation to speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
