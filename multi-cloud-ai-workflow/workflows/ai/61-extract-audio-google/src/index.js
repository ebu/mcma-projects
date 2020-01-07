//"use strict"
const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();

const { Exception, EnvironmentVariableProvider, NotificationEndpoint, JobParameterBag, AIJob, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FolderLocator, AwsS3FileLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-61-extract-audio-google", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const ActivityArn = process.env.ActivityArn;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const RepositoryBucket = process.env.RepositoryBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;

// Local Define
// see definition of name according to profileName defined in deployment/services/src/index.js
const JOB_PROFILE_NAME = "ExtractAudio";
const JOB_RESULTS_PREFIX = "ExtractAudioJobResults/";


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

        logger.info("#######################################################");
        logger.info("61-extract-audio-google - Google speech-to-text - START");
        logger.info("#######################################################");

        // send update notification
        try {
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

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);
        logger.info("event:", event);

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });
        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;
        // if not found bail out
        if (!jobProfileId) {
            throw new Exception("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("notificationUrl:", notificationUrl);

        // creating the extract audio and Google speech-to-text job giving the original mp4 file as input.
        let job = new AIJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: event.data.mediaFileLocator,
                outputLocation: new AwsS3FolderLocator({
                    awsS3Bucket: WebsiteBucket,
                    awsS3KeyPrefix: JOB_RESULTS_PREFIX
                })
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            }),
            tracker: event.tracker,
        });

        // posting the ai job to the job repository
        await resourceManager.create(job);
    } catch (error) {
        logger.error("Failed to extract audio");
        logger.error(error.toString());
        throw new Exception("Failed to extract audio", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
