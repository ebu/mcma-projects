import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { JobParameterBag, JobProfile, McmaException, McmaTracker, NotificationEndpoint, TransformJob } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

const StepFunctions = new AWS.StepFunctions();

const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-401-extract-audio-google", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const ActivityArn = process.env.ActivityArn;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const TempBucket = process.env.TempBucket;

// Local Define
// see definition of name according to profileName defined in deployment/services/src/index.js
const JOB_PROFILE_NAME = "ExtractAudio";
const JOB_RESULTS_PREFIX = "ExtractAudioJobResults/";

type InputEvent = {
    input: {
        bmContent: string
    }
    data: {
        mediaFileLocator: AwsS3FileLocator
    }
    tracker?: McmaTracker
}

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

        // creating the extract audio and Google speech-to-text job giving the original mp4 file as input.
        let job = new TransformJob({
            jobProfileId: jobProfile.id,
            jobInput: new JobParameterBag({
                inputFile: event.data.mediaFileLocator,
                outputLocation: new AwsS3FolderLocator({
                    bucket: TempBucket,
                    keyPrefix: JOB_RESULTS_PREFIX
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
        logger.error("Failed to extract audio");
        logger.error(error.toString());
        throw new McmaException("Failed to extract audio", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
