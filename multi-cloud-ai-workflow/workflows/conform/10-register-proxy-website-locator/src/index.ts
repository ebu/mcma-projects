import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator } from "@mcma/aws-s3";
import { BMEssence } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-10-register-proxy-website-locator", process.env.LogGroupName);

type InputEvent = {
    data: {
        bmEssence: string
        websiteFile: AwsS3FileLocator
    }
    progress?: number
    tracker?: McmaTracker
    notificationEndpoint?: NotificationEndpointProperties
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
            event.progress = 81;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // acquire the registered BMEssence
        let bme = await resourceManager.get<BMEssence>(event.data.bmEssence);

        // update BMEssence
        bme.locations = [event.data.websiteFile];

        bme = await resourceManager.update(bme);

        return bme.id;
    } catch (error) {
        logger.error("Failed to register proxy website locator");
        logger.error(error.toString());
        throw new McmaException("Failed to register proxy website locator", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
