//"use strict";
const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();

const { Exception, EnvironmentVariableProvider, NotificationEndpoint, JobParameterBag, AIJob, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FolderLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

// Environment Variable(AWS Lambda) and identification of buckets e.g. the TempBucket below
const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

// link to the service.profileName defined in the service associated with the job
const JOB_PROFILE_NAME = "AWSTranscribeAudio";
// directory under which result of that job / service will be returned. The Bucket where this directory will be created is defined in the job profile below
const JOB_RESULTS_PREFIX = "AIResults/";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-02-extract-speech-to-text", process.env.LogGroupName);

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
            event.parallelProgress = { "speech-text-translate": 20 };
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

        // using input from activity task to ensure we don't have race conditions if two workflows executing simultanously.
        event = JSON.parse(data.input);

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });
        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;
        // if not found bail out
        if (!jobProfileId) {
            throw new Exception("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        // define a url to receive notifications to be visualised in CloudWatch (AWS console) in console logs
        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("NotificationUrl:", notificationUrl);

        // creating job
        // the awsS3KeyPrefix is a directory
        let job = new AIJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: event.data.mediaFileLocator,
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
        logger.error("Failed to extract speech to text");
        logger.error(error.toString());
        throw new Exception("Failed to extract speech to text", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
