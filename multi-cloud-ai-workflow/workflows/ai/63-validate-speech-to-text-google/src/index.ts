//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

import { McmaException, EnvironmentVariableProvider, NotificationEndpoint, JobParameterBag, AIJob, JobProfile, JobBaseProperties, McmaTrackerProperties } from "@mcma/core";
import { ResourceManager, AuthProvider, getResourceManagerConfig } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FolderLocator, AwsS3FileLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-63-validate-speech-to-text-google", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "ValidateSpeechToTextGoogle";
const JOB_RESULTS_PREFIX = "AIResults/";

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
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

        logger.info("jobProfiles:", jobProfiles);

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        logger.info("jobProfileId:", jobProfileId);

        // manage notification
        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("notificationUrl:", notificationUrl);

        // writing speech transcription to a textfile in temp bucket
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        logger.info("bmContent:", bmContent);

        // writing CLEAN speech transcription to a textfile in temp bucket and provide via bmContent
        // Other option, SEE ALSO Bucket: TempBucket, Key: "stt/stt_output_clean" + ".txt", from step 3

        if (!bmContent.googleAiMetadata ||
            !bmContent.googleAiMetadata.transcription) {
            throw new McmaException("Missing transcription on BMContent");
        }

        logger.info("bmContent.googleAiMetadata:", bmContent.googleAiMetadata);
        logger.info("bmContent.googleAiMetadata.transcription:", bmContent.googleAiMetadata.transcription);

        let s3Params = {
            Bucket: TempBucket,
            Key: "temp/stt_output_google.txt",
            Body: bmContent.googleAiMetadata.transcription
        };

        await S3.putObject(s3Params).promise();

        // creating stt benchmarking job
        let job = new AIJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    awsS3Bucket: s3Params.Bucket,
                    awsS3Key: s3Params.Key
                }),
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
        logger.error("Failed to validate speech to text google");
        logger.error(error.toString());
        throw new McmaException("Failed to validate speech to text google", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
