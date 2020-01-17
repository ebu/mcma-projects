//"use strict";
const AWS = require("aws-sdk");

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-01-validate-workflow-input", process.env.LogGroupName);

/* Expecting input like the following:

 {
 "input": {
 "bmContent": https://urlToBmContent,
 "bmEssence": https://urlToBmEssence
 },
 "notificationEndpoint": {
 "@type": "NotificationEndpoint",
 "httpEndpoint": "http://workflow-service/job-assignments/34543-34-534345-34/notifications"
 }
 }

 Note that the notification endpoint is optional. But is used to notify progress and completed/failed of workflow.
 */


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
            event.progress = 0;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // check the input and return mediaFileLocator which service as input for the AI workflows
        if (!event || !event.input) {
            throw new Error("Missing workflow input");
        }

        let input = event.input;

        if (!input.bmContent) {
            throw new Error("Missing input.bmContent");
        }

        if (!input.bmEssence) {
            throw new Error("Missing input.bmEssence");
        }

        let bmContent = await resourceManager.get(input.bmContent);
        let bmEssence = await resourceManager.get(input.bmEssence);

        logger.info(bmContent);
        logger.info(bmEssence);

        let mediaFileLocator;

        // find the media locator in the website bucket with public httpEndpoint
        for (const locator of bmEssence.locations) {
            if (locator.awsS3Bucket === WebsiteBucket) {
                mediaFileLocator = locator;
            }
        }

        if (!mediaFileLocator) {
            throw new Exception("No suitable Locator found on bmEssence");
        }

        if (!mediaFileLocator.httpEndpoint) {
            throw new Exception("Media file Locator does not have an httpEndpoint");
        }

        return mediaFileLocator;
    } catch (error) {
        logger.error("Failed to validate workflow input");
        logger.error(error.toString());
        throw new Exception("Failed to validate workflow input", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
