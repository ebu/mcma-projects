import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator } from "@mcma/aws-s3";
import { BMContent, DescriptiveMetadata } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-03-create-media-asset", process.env.LogGroupName);

type InputEvent = {
    input: {
        metadata: {
            name: string
            description: string
        };
        inputFile: AwsS3FileLocator
    }
    progress?: number
    tracker?: McmaTracker
    notificationEndpoint?: NotificationEndpointProperties
}

/**
 * Create New BMContent Object
 * @param {*} title title
 * @param {*} description description
 */
function createBMContent(name: string, description: string): BMContent {
    // init bmcontent
    let bmContent = new BMContent({
        metadata: new DescriptiveMetadata({ name, description }),
        essences: []
    });
    return bmContent;
}

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
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
            throw new McmaException("Failed to register BMContent.");
        }

        // return the URL to the BMContent
        return bmc.id;
    } catch (error) {
        logger.error("Failed to create media asset");
        logger.error(error.toString());
        throw new McmaException("Failed to create media asset", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
