import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AIJob, EnvironmentVariableProvider, JobParameterBag, JobProfile, McmaException, McmaTracker, NotificationEndpoint } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent } from "@local/common";

const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-105-translate-speech-transcription", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "AWSTranslateText";
const JOB_RESULTS_PREFIX = "AIResults/";

type InputEvent = {
    input: {
        bmContent: string
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

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        // manage notification
        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("NotificationUrl:", notificationUrl);

        // writing speech transcription to a textfile in temp bucket
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // writing CLEAN speech transcription from bmContent to a textfile in temp bucket for transfer to translation service
        if (!bmContent.awsAiMetadata ||
            !bmContent.awsAiMetadata.cleanTranscription ||
            !bmContent.awsAiMetadata.cleanTranscription.original) {
            throw new McmaException("Missing transcription on BMContent");
        }

        let s3Params = {
            Bucket: TempBucket,
            Key: "AiInput/stt_output_clean.txt",
            Body: bmContent.awsAiMetadata.cleanTranscription.original
        };
        await S3.putObject(s3Params).promise();

        // creating job translation of clean transcription
        let job = new AIJob({
            jobProfileId: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    bucket: s3Params.Bucket,
                    key: s3Params.Key
                }),
                targetLanguageCode: "fr",
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

        // posting the job to the job repository
        job = await resourceManager.create(job);
    } catch (error) {
        logger.error("Failed to translate speech transcription");
        logger.error(error.toString());
        throw new McmaException("Failed to translate speech transcription", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
