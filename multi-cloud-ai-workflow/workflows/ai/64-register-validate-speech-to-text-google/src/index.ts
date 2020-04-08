//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
const S3 = new AWS.S3();

import { McmaException, EnvironmentVariableProvider, JobBaseProperties, McmaTrackerProperties, Job, JobParameterBag } from "@mcma/core";
import { ResourceManager, AuthProvider, getResourceManagerConfig } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { BMContent, BMEssence } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-64-register-validate-speech-to-text-google", process.env.LogGroupName);

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
    data: {
        validateSpeechToTextGoogleJobId: string[];
    };
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

        // get ai job id (first non null entry in array)
        let jobId = event.data.validateSpeechToTextGoogleJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain TranslationJobId");
        }
        logger.info("[TranslationJobId]:", jobId);

        let job = await resourceManager.get<Job>(jobId);
        let jobOutput = new JobParameterBag(job.jobOutput);

        // get service result/outputfile from location bucket+key(prefix+filename)
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
            throw new McmaException("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        // get stt benchmarking worddiffs results
        let worddiffs = s3Object.Body.toString();
        logger.info(worddiffs);

        // identify associated bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);
        // attach worddiffs results to bmContent property translation
        if (!bmContent.googleAiMetadata) {
            bmContent.googleAiMetadata = {};
        }
        if (!bmContent.googleAiMetadata) {
            bmContent.googleAiMetadata = {};
        }
        bmContent.googleAiMetadata.worddiffs = worddiffs;

        // update bmContent
        await resourceManager.update(bmContent);

        try {
            // event.parallelProgress = { "speech-text-translate": 100 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            console.warn("Failed to send notification", error);
        }
    } catch (error) {
        logger.error("Failed to register extract audio google");
        logger.error(error.toString());
        throw new McmaException("Failed to register extract audio google", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
