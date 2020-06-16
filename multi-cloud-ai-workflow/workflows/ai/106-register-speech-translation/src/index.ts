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
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-106-register-speech-translation", process.env.LogGroupName);

type InputEvent = {
    input: {
        bmContent: string
    },
    data: {
        translateJobId: string[]
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

        // send update notification
        try {
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.translateJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain TranslationJobId");
        }
        logger.info("[TranslationJobId]:", jobId);

        let job = await resourceManager.get<Job>(jobId);
        let jobOutput = new JobParameterBag(job.jobOutput);

        // get translate-text service results/outputfile from location bucket+key(prefix+filename)
        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message, error);
        }

        // get translation result
        let translationResult = s3Object.Body.toString();
        // French
        let tokenizedTranslationResult = translationResult.split(".");
        // Japanese
        //let tokenizedTranslationResult = translationResult.split('。');
        logger.info(tokenizedTranslationResult);

        // identify associated bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // attach translation and tokenized translation texts to bmContent property translation
        if (!bmContent.awsAiMetadata) {
            bmContent.awsAiMetadata = {};
        }
        if (!bmContent.awsAiMetadata.transcription) {
            bmContent.awsAiMetadata.transcription = {};
        }
        bmContent.awsAiMetadata.transcription.translation = translationResult;
        bmContent.awsAiMetadata.transcription.tokenizedTranslation = tokenizedTranslationResult;

        // update bmContent
        await resourceManager.update(bmContent);
    } catch (error) {
        logger.error("Failed to register speech translation");
        logger.error(error.toString());
        throw new McmaException("Failed to register speech translation", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
