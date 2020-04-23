//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
const S3 = new AWS.S3();

import { McmaException, EnvironmentVariableProvider, JobBaseProperties, McmaTrackerProperties, Locator, Job, JobParameterBag } from "@mcma/core";
import { ResourceManager, AuthProvider, getResourceManagerConfig } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, getS3Url } from "@mcma/aws-s3";
import { BMContent, BMEssence } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-62-register-extract-audio-google", process.env.LogGroupName);

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
    data: {
        extractAudioJobId: string[];
    };
} & JobBaseProperties;

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 * @param {*} title of the media file
 * @param {*} description of the media file
 */
function createBMEssence(bmContent: BMContent, location: AwsS3FileLocator, title: string, description: string): BMEssence {
    // init bmcontent
    let bmEssence = new BMEssence({
        bmContent: bmContent.id,
        locations: [location],
        title: title,
        description: description,
    });
    return bmEssence;
}

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

        let jobId = event.data.extractAudioJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain extractAudioJobId");
        }
        logger.info("[ExtractAudioJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(JSON.stringify(job, null, 2));
        
        let jobOutput = new JobParameterBag(job.jobOutput);

        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        logger.info("outputFile:", outputFile);

        // destination bucket: AIJob outputlocation
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;
        logger.info("s3Bucket:", s3Bucket);
        logger.info("s3Key:", s3Key);

        // construct public https endpoint
        let mediaFileUri = await getS3Url(outputFile, S3);

        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        logger.info("s3Object.Body.toString()", s3Object.Body.toString());

        let transcription = s3Object.Body.toString();

        // acquire the registered BMContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        if (!bmContent.googleAiMetadata) {
            bmContent.googleAiMetadata = {};
        }

        bmContent.googleAiMetadata.transcription = transcription;

        // create BMEssence
        let locator = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: s3Key
        });
        await getS3Url(locator, S3);

        let bmEssence = createBMEssence(bmContent, locator, "audio-google", "audio-google");

        // register BMEssence
        bmEssence = await resourceManager.create(bmEssence);
        if (!bmEssence.id) {
            throw new McmaException("Failed to register BMEssence.");
        }

        // addin BMEssence ID
        bmContent.essences.push(bmEssence.id);
        logger.info("bmContent", bmContent);

        // update BMContents
        bmContent = await resourceManager.update(bmContent);
        logger.info("bmContent", bmContent);

        // the URL to the BMEssence with dubbed audio file and srt
        return bmEssence.id;
    } catch (error) {
        logger.error("Failed to register extract audio google");
        logger.error(error.toString());
        throw new McmaException("Failed to register extract audio google", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
