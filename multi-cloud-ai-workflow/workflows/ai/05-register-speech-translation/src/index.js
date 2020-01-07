//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-05-register-speech-translation", process.env.LogGroupName);

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
        let jobId = event.data.translateJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain TranslationJobId");
        }
        logger.info("[TranslationJobId]:", jobId);

        let job = await resourceManager.get(jobId);


        // get translate-text service results/outputfile from location bucket+key(prefix+filename)
        let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
        let s3Key = job.jobOutput.outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message, error);
        }

        // get translation result
        let translationResult = s3Object.Body.toString();
        // French
        let tokenizedTranslationResult = translationResult.split(".");
        // Japanese
        //let tokenizedTranslationResult = translationResult.split('。');
        logger.info(tokenizedTranslationResult);

        // identify associated bmContent
        let bmContent = await resourceManager.get(event.input.bmContent);

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
        throw new Exception("Failed to register speech translation", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
