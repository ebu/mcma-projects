//"use strict";
const AWS = require("aws-sdk");

const { Exception, EnvironmentVariableProvider, BMContent } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-03-create-media-asset", process.env.LogGroupName);

/**
 * Create New BMContent Object
 * @param {*} title title
 * @param {*} description description
 */
function createBMContent(title, description) {
    // init bmcontent
    let bmContent = new BMContent({
        name: title,
        description: description,
        bmEssences: [],
        awsAiMetadata: null,
        awsSrt: null,
        azureAiMetadata: null,
        azureSrt: null,
    });
    return bmContent;
}

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
            event.progress = 18;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // metadata of lambda input parameter
        let metadata = event.input.metadata;

        // create bm content object
        let bmc = createBMContent(metadata.name, metadata.description);

        // post bm content
        bmc = await resourceManager.create(bmc);

        // check if BMContent is registered
        if (!bmc.id) {
            throw new Exception("Failed to register BMContent.");
        }

        // return the URL to the BMContent
        return bmc.id;
    } catch (error) {
        logger.error("Failed to create media asset");
        logger.error(error.toString());
        throw new Exception("Failed to create media asset", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
