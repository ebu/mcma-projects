import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { BMContent } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-15-register-tokenized-translation-to-speech", process.env.LogGroupName);

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
    data: {
        tokenizedTextToSpeechJobId: string[]
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

        // send update notification
        try {
            event.parallelProgress = { "tokenized-text-to-speech": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.tokenizedTextToSpeechJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain TextToSpeechJobId");
        }
        logger.info("[TokenizedTextToSpeechJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(JSON.stringify(job, null, 2));

        let jobOutput = new JobParameterBag(job.jobOutput);

        // Copy textToSpeech output file to output location
        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");

        // get object from location bucket+key(prefix+filename)
        let s3Bucket_ssml = outputFile.awsS3Bucket;
        let s3Key_ssml = outputFile.awsS3Key;
        let s3Object_ssml;
        try {
            s3Object_ssml = await S3.getObject({
                Bucket: s3Bucket_ssml,
                Key: s3Key_ssml,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to copy ssml file in bucket '" + s3Bucket_ssml + "' with key '" + s3Key_ssml + "' due to error: " + error.message);
        }

        // identify associated bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // attach ssml of translation text to bmContent property translation 
        if (!bmContent.awsAiMetadata) {
            bmContent.awsAiMetadata = {};
        }
        if (!bmContent.awsAiMetadata.transcription) {
            bmContent.awsAiMetadata.transcription = {};
        }
        bmContent.awsAiMetadata.transcription.ssmlTranslation = s3Object_ssml.Body.toString();

        // update BMContents with reference to text-to-speech output source file
        bmContent = await resourceManager.update(bmContent);

    } catch (error) {
        logger.error("Failed to register tokenized translation of speech");
        logger.error(error.toString());
        throw new McmaException("Failed to register tokenized translation of speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
