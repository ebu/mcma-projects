//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { McmaException, EnvironmentVariableProvider, NotificationEndpoint, JobParameterBag, AIJob, McmaTrackerProperties, JobProfile, JobBaseProperties } from "@mcma/core";
import { ResourceManager, AuthProvider, getResourceManagerConfig } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FolderLocator, AwsS3FileLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent } from "@local/common";

const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-04-translate-speech-transcription", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "AWSTranslateText";
const JOB_RESULTS_PREFIX = "AIResults/";

type InputEvent = {
    parallelProgress?: { [key: string]: number },
    input: {
        bmContent: string
    }
} & JobBaseProperties;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
export async function handler(event: InputEvent, context: Context) {
    const tracker = typeof event.tracker === "string" ? JSON.parse(event.tracker) as McmaTrackerProperties : event.tracker;
    const logger = loggerProvider.get(tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);
        logger.info(TempBucket, ActivityCallbackUrl, ActivityArn);

        // send update notification
        try {
            event.parallelProgress = { "speech-text-translate": 60 };
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
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    awsS3Bucket: s3Params.Bucket,
                    awsS3Key: s3Params.Key
                }),
                targetLanguageCode: "fr",
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
        logger.error("Failed to translate speech transcription");
        logger.error(error.toString());
        throw new McmaException("Failed to translate speech transcription", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
