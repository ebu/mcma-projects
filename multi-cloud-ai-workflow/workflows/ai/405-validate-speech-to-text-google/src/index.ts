import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";

import { AIJob, EnvironmentVariableProvider, JobBaseProperties, JobParameterBag, JobProfile, McmaException, NotificationEndpoint, QAJob } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent } from "@local/common";

const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-405-validate-speech-to-text-google", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "BenchmarkSTT";
const JOB_RESULTS_PREFIX = "BenchmarkSTT/";

type InputEvent = {
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
        const [jobProfile] = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });

        // if not found bail out
        if (!jobProfile) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

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
            Key: JOB_RESULTS_PREFIX + "/input_" + uuidv4() + ".txt",
            Body: bmContent.googleAiMetadata.transcription
        };

        await S3.putObject(s3Params).promise();

        // creating stt benchmarking job
        let job = new QAJob({
            jobProfile: jobProfile.id,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    awsS3Bucket: s3Params.Bucket,
                    awsS3Key: s3Params.Key
                }),
                referenceFile: new AwsS3FileLocator({
                    awsS3Bucket: WebsiteBucket,
                    awsS3Key: "assets/stt/clean_transcript_2015_GF_ORF_00_18_09_conv.txt",
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
