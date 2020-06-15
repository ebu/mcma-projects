import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";

import { AIJob, EnvironmentVariableProvider, JobBaseProperties, JobParameterBag, JobProfile, McmaException, NotificationEndpoint } from "@mcma/core";
import { AwsS3FileLocatorProperties, AwsS3FolderLocator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-403-speech-to-text-google", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "GoogleSpeechToText";
const JOB_RESULTS_PREFIX = "GoogleSpeechToTextResults/";

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
    data: {
        mediaFileLocator: AwsS3FileLocatorProperties;
        audioFileLocator: AwsS3FileLocatorProperties;
    };
} & JobBaseProperties;

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);
        logger.info(TempBucket, ActivityCallbackUrl, ActivityArn);

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
            throw new McmaException("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);
        logger.info("event:", event);

        // get job profile filtered by name
        const [jobProfile] = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });
        // if not found bail out
        if (!jobProfile) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("notificationUrl: " + notificationUrl);

        // creating the extract audio and Google speech-to-text job giving the extracted audio flac file as input.
        let job = new AIJob({
            jobProfile: jobProfile.id,
            jobInput: new JobParameterBag({
                inputFile: event.data.audioFileLocator,
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

        // posting the ai job to the job repository
        job = await resourceManager.create(job);

        return job.id;
    } catch (error) {
        logger.error("Failed to validate speech to text google");
        logger.error(error.toString());
        throw new McmaException("Failed to validate speech to text google", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
