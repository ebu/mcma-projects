import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AIJob, EnvironmentVariableProvider, JobBaseProperties, JobParameterBag, JobProfile, McmaException, NotificationEndpoint } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent } from "@local/common";

const StepFunctions = new AWS.StepFunctions();
const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-14-tokenized-translation-to-speech", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "AWSTokenizedTextToSpeech";
const JOB_RESULTS_PREFIX = "AIResults/ssml/";

type InputEvent = {
    parallelProgress: { [key: string]: number },
    input: {
        bmContent: string;
    }
} & JobBaseProperties;

// Calling text-to-speech Polly service to analyse translation text per sentence and generate SSML file for speech to text
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
            event.parallelProgress = { "text-to-speech": 60 };
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

        logger.info("[tokenized:]", jobProfileId);

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        // writing speech transcription to a textfile in temp bucket from translation associated to bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        if (!bmContent.awsAiMetadata ||
            !bmContent.awsAiMetadata.transcription ||
            !bmContent.awsAiMetadata.transcription.translation) {
            throw new McmaException("Missing translation on BMContent");
        }
        // extract translation from bmContent and load in a file in tempBucket
        let s3Params = {
            Bucket: TempBucket,
            Key: "AiInput/translation.txt",
//        Key: "AiInput/tokenizedTranslation.txt",
            Body: bmContent.awsAiMetadata.transcription.translation
        };
        await S3.putObject(s3Params).promise();
        logger.info(bmContent.awsAiMetadata.transcription.translation);


        // extract preloaded and edited srt_translation_output.srt websiteBucket/assets/srt and transfer in a file in tempBucket/srt
        let s3Object_assets_srt;
        try {
            s3Object_assets_srt = await S3.getObject({
                Bucket: WebsiteBucket,
                Key: "assets/srt/srt_translation_output.srt",
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to copy translation srt file from bucket '" + WebsiteBucket + "' with key '" + "assets/srt/srt_translation_output.srt" + "' due to error: " + error.message);
        }
        let s3Params_translation_srt = {
            Bucket: TempBucket,
            Key: "srt/srt_translation_output.srt",
            Body: s3Object_assets_srt.Body
        };
        await S3.putObject(s3Params_translation_srt).promise();

        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("NotificationUrl:", notificationUrl);

        // creating job using file with (tokenized) translation text stored in temp bucket
        let job = new AIJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    awsS3Bucket: s3Params.Bucket,
                    awsS3Key: s3Params.Key
                }),
                voiceId: "Mizuki",
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
        logger.error("Failed to do tokenized translation to speech");
        logger.error(error.toString());
        throw new McmaException("Failed to do tokenized translation to speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
