//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-11-register-emotions-info-aws", process.env.LogGroupName);

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
            event.parallelProgress = { "detect-emotions-aws": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.awsEmotionsJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain awsEmotionsJobId");
        }
        logger.info("jobId", jobId);

        let job = await resourceManager.get(jobId);

        // get emotions info
        let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
        let s3Key = job.jobOutput.outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to emotions info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        let emotionsResult = JSON.parse(s3Object.Body.toString());

        // logger.info("emotionsResult[0]: ", JSON.stringify(emotionsResult[0], null, 2));

        // returning here as we probably should not attach the whole metadata file to the bmContent.
        return;

        // let bmContent = await resourceManager.get(event.input.bmContent);
        //
        // if (!bmContent.awsAiMetadata) {
        //     bmContent.awsAiMetadata = {};
        // }
        // bmContent.awsAiMetadata.emotions = emotionsResult;
        //
        // await resourceManager.update(bmContent);
        //
        // try {
        //     event.parallelProgress = { "detect-emotions-aws": 100 };
        //     await resourceManager.sendNotification(event);
        // } catch (error) {
        //     console.warn("Failed to send notification", error);
        // }

    } catch (error) {
        logger.error("Failed to register emotions info");
        logger.error(error.toString());
        throw new Exception("Failed to register emotions info", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
