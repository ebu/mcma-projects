//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-15-register-tokenized-translation-to-speech", process.env.LogGroupName);


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
            event.parallelProgress = { "tokenized-text-to-speech": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.tokenizedTextToSpeechJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain TextToSpeechJobId");
        }
        logger.info("[TokenizedTextToSpeechJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get(jobId);
        logger.info(JSON.stringify(job, null, 2));

        // Copy textToSpeech output file to output location
        let outputFile = job.jobOutput.outputFile;

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
            throw new Exception("Unable to copy ssml file in bucket '" + s3Bucket_ssml + "' with key '" + s3Key_ssml + "' due to error: " + error.message);
        }

        // identify associated bmContent
        let bmContent = await resourceManager.get(event.input.bmContent);

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
        throw new Exception("Failed to register tokenized translation of speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
