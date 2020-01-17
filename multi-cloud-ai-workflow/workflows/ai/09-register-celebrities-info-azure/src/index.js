//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-09-register-celebrities-info-azure", process.env.LogGroupName);

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    const logger = loggerProvider.get(event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            event.parallelProgress = { "detect-celebrities-azure": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.azureCelebritiesJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain azureCelebritiesJobId");
        }
        logger.info("[azureCelebritiesJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get(jobId);

        // get media info
        let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
        let s3Key = job.jobOutput.outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key
            }).promise();
        } catch (error) {
            throw new Exception("Unable to find data file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        let azureResult = JSON.parse(s3Object.Body.toString());
        logger.info("AzureResult: " + JSON.stringify(azureResult, null, 2));

        let bmContent = await resourceManager.get(event.input.bmContent);

        let azureAiMetadata = bmContent.azureAiMetadata || {};
        azureAiMetadata = azureResult;
        bmContent.azureAiMetadata = azureAiMetadata;

        let azureTranscription = "";
        if (azureAiMetadata.videos) {
            for (const video of azureAiMetadata.videos) {
                if (video.insights) {
                    if (video.insights.transcript) {

                        for (const transcript of video.insights.transcript) {
                            if (transcript.text) {
                                azureTranscription += transcript.text + " ";
                            }
                        }
                        azureTranscription.trim();
                    }

                }
            }
        }

        if (!bmContent.azureAiMetadata.azureTranscription) {
            bmContent.azureAiMetadata.azureTranscription = {};
        }

        bmContent.azureAiMetadata.azureTranscription.transcription = azureTranscription;

        await resourceManager.update(bmContent);

        try {
            event.parallelProgress = { "detect-celebrities-azure": 100 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }
    } catch (error) {
        logger.error("Failed to register celebrities info");
        logger.error(error.toString());
        throw new Exception("Failed to register celebrities info", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
