//"use strict";
const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();

const { Exception, EnvironmentVariableProvider, TransformJob, JobParameterBag, NotificationEndpoint, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FolderLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-07b-long-transcode", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const ActivityArn = process.env.ActivityArn;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const RepositoryBucket = process.env.RepositoryBucket;

// Local Define
const JOB_PROFILE_NAME = "CreateProxyEC2";

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

        // send update notification
        try {
            event.progress = 54;
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

        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        console.log("NotificationUrl:", notificationUrl);

        // creating the tranformjob(ec2)
        let createProxyJob = new TransformJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: event.data.repositoryFile,
                outputLocation: new AwsS3FolderLocator({
                    awsS3Bucket: RepositoryBucket,
                    awsS3KeyPrefix: "TransformJobResults/"
                })
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            })
        });

        // posting the transformjob to the job repository
        createProxyJob = await resourceManager.create(createProxyJob);
    } catch (error) {
        logger.error("Failed to start long transcode");
        logger.error(error.toString());
        throw new Exception("Failed to start long transcode", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
