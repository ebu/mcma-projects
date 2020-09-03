import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";

import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { BMContent } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-404-register-speech-to-text-google", process.env.LogGroupName);


type InputEvent = {
    input: {
        bmContent: string;
    };
    data: {
        mediaFileLocator: AwsS3FileLocatorProperties;
        extractAudioJobId: string[];
        audioFileLocator: AwsS3FileLocatorProperties;
        speechToTextGoogleJobId: string[];
    };
} & JobBaseProperties;

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        let [jobId] = event.data.speechToTextGoogleJobId;
        if (!jobId) {
            throw new McmaException("Failed to obtain speechToTextGoogleJobId");
        }
        logger.info("[speechToTextGoogleJobId]: " + jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(job);

        let jobOutput = new JobParameterBag(job.jobOutput);

        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        logger.info("outputFile: " + outputFile);

        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: outputFile.bucket,
                Key: outputFile.key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to access file in bucket '" + outputFile.bucket + "' with key '" + outputFile.key + "' due to error: " + error.message);
        }

        let transcription = s3Object.Body.toString();

        logger.info("Transcription: " + transcription);

        // acquire the registered BMContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        if (!bmContent.googleAiMetadata) {
            bmContent.googleAiMetadata = {};
        }

        bmContent.googleAiMetadata.transcription = transcription;

        // update BMContents
        bmContent = await resourceManager.update(bmContent);
        logger.info("bmContent");
        logger.info(bmContent);
    } catch (error) {
        logger.error("Failed to register google transcribe results");
        logger.error(error.toString());
        throw new McmaException("Failed to register google transcribe results", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
