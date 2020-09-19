import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, JobStatus, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("process-workflow-completion", process.env.LogGroupName);

type InputEvent = {
    status?: JobStatus
    progress?: number
    tracker?: McmaTracker
    notificationEndpoint?: NotificationEndpointProperties
}

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            event.status = JobStatus.Completed;
            event.progress = 100;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.error("Failed to send notification");
            logger.error(error.toString());
        }
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
