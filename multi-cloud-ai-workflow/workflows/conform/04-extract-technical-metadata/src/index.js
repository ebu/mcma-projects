//"use strict";
const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();

const { Exception, EnvironmentVariableProvider, AmeJob, JobParameterBag, NotificationEndpoint, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FolderLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-04-extract-technical-metadata", process.env.LogGroupName);

// Environment Variable(AWS Lambda)

const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

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
            event.progress = 27;
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

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: "ExtractTechnicalMetadata" });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new Exception("JobProfile 'ExtractTechnicalMetadata' not found");
        }

        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("NotificationUrl:", notificationUrl);

        // creating ame job
        let ameJob = new AmeJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: event.data.repositoryFile,
                outputLocation: new AwsS3FolderLocator({
                    awsS3Bucket: TempBucket,
                    awsS3KeyPrefix: "AmeJobResults/"
                })
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            }),
            tracker: event.tracker
        });

        logger.info("Sending AmeJob:", JSON.stringify(ameJob, null, 2));

        // posting the amejob to the job repository
        ameJob = await resourceManager.create(ameJob);
    } catch (error) {
        logger.error("Failed to extract technical metadata");
        logger.error(error.toString());
        throw new Exception("Failed to extract technical metadata", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
