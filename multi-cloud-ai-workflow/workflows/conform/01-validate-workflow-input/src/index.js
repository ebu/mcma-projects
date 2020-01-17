//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-01-validate-workflow-input", process.env.LogGroupName);

// Expecting input like the following:
// {
//     "input": {
//         "metadata": {
//             "@type": "DescriptiveMetadata",
//             "name": "Cat video",
//             "description": "Great video of cats"
//         },
//         "inputFile": {
//             "@type": "Locator",
//             "awsS3Bucket": "bucket_name",
//             "awsS3Key": "key_name"
//         }
//     },
//     "notificationEndpoint": {
//         "@type": "NotificationEndpoint",
//         "httpEndpoint": "http://workflow-service/job-assignments/34543-34-534345-34/notifications"
//     }
// }
//
// Note that the notification endpoint is optional. But is used to notify progress and completed/failed of workflow.

exports.handler = async (event, context) => {
    const logger = loggerProvider.get(event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            event.progress = 0;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // checking input
        if (!event || !event.input) {
            throw new Exception("Missing workflow input");
        }

        let input = event.input;

        if (!input.metadata) {
            throw new Exception("Missing input.metadata");
        }

        if (!input.metadata.name) {
            throw new Exception("Missing input.metadata.name");
        }

        if (!input.metadata.description) {
            throw new Exception("Missing input.metadata.description");
        }

        if (!input.inputFile) {
            throw new Exception("Missing input.inputFile");
        }

        let s3Bucket = input.inputFile.awsS3Bucket;
        let s3Key = input.inputFile.awsS3Key;

        let data;

        try {
            data = await S3.headObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        return data;
    } catch (error) {
        logger.error("Failed to validate workflow input");
        logger.error(error.toString());
        throw new Exception("Failed to validate workflow input", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
