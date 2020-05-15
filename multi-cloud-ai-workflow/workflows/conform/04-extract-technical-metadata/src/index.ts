import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AmeJob, EnvironmentVariableProvider, JobBaseProperties, JobParameterBag, JobProfile, McmaException, NotificationEndpoint } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

const StepFunctions = new AWS.StepFunctions();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-04-extract-technical-metadata", process.env.LogGroupName);

// Environment Variable(AWS Lambda)

const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

type InputEvent = {
    input: {
        metadata: {
            name: string;
            description: string;
        };
        inputFile: AwsS3FileLocator;
    };
    data: {
        repositoryFile: AwsS3FileLocator;
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
            throw new McmaException("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: "ExtractTechnicalMetadata" });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile 'ExtractTechnicalMetadata' not found");
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
        throw new McmaException("Failed to extract technical metadata", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
