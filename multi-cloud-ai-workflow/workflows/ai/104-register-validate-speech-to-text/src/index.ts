import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobParameterBag, McmaException, McmaTracker } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { BMContent } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-104-register-validate-speech-to-text", process.env.LogGroupName);

type InputEvent = {
    input: {
        bmContent: string
    }
    data: {
        validateSpeechToTextJobId: string[]
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

        // get ai job id (first non null entry in array)
        let jobId = event.data.validateSpeechToTextJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain TranslationJobId");
        }
        logger.info("[TranslationJobId]:", jobId);

        let job = await resourceManager.get<Job>(jobId);
        let jobOutput = new JobParameterBag(job.jobOutput);

        // get service result/outputfile from location bucket+key(prefix+filename)
        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        let s3Bucket = outputFile.bucket;
        let s3Key = outputFile.key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        // get stt benchmarking worddiffs results
        let worddiffs = s3Object.Body.toString();
        logger.info(worddiffs);

        // identify associated bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);
        // attach worddiffs results to bmContent property translation
        if (!bmContent.awsAiMetadata) {
            bmContent.awsAiMetadata = {};
        }
        if (!bmContent.awsAiMetadata.transcription) {
            bmContent.awsAiMetadata.transcription = {};
        }
        bmContent.awsAiMetadata.transcription.worddiffs = worddiffs;

        // update bmContent
        await resourceManager.update(bmContent);
    } catch (error) {
        logger.error("Failed to register dubbing SRT");
        logger.error(error.toString());
        throw new McmaException("Failed to register dubbing SRT", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
