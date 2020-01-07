//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-32-register-validate-speech-to-text", process.env.LogGroupName);

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
            event.parallelProgress = { "speech-text-translate": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.validateSpeechToTextJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain TranslationJobId");
        }
        logger.info("[TranslationJobId]:", jobId);

        let job = await resourceManager.get(jobId);


        // get service result/outputfile from location bucket+key(prefix+filename)
        let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
        let s3Key = job.jobOutput.outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        // get stt benchmarking worddiffs results
        let worddiffs = s3Object.Body.toString();
        logger.info(worddiffs);

        // identify associated bmContent
        let bmContent = await resourceManager.get(event.input.bmContent);
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

        try {
            event.parallelProgress = { "speech-text-translate": 100 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }
    } catch (error) {
        logger.error("Failed to register dubbing SRT");
        logger.error(error.toString());
        throw new Exception("Failed to register dubbing SRT", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
