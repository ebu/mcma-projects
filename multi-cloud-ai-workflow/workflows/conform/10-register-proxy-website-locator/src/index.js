//"use strict";
const AWS = require("aws-sdk");

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-10-register-proxy-website-locator", process.env.LogGroupName);

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
            event.progress = 81;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // acquire the registered BMEssence
        let bme = await resourceManager.get(event.data.bmEssence);

        // update BMEssence
        bme.locations = [event.data.websiteFile];

        bme = await resourceManager.update(bme);

        return bme.id;
    } catch (error) {
        logger.error("Failed to register proxy website locator");
        logger.error(error.toString());
        throw new Exception("Failed to register proxy website locator", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
