//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";import { EnvironmentVariableProvider, JobStatus, McmaTrackerProperties, JobBaseProperties } from "@mcma/core";
import { ResourceManager, AuthProvider, getResourceManagerConfig } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("process-workflow-failure", process.env.LogGroupName);

type InputEvent = {
    error: {
        Cause?: string;
    };
} & JobBaseProperties;

export async function handler(event: InputEvent, context: Context) {
    const tracker = typeof event.tracker === "string" ? JSON.parse(event.tracker) as McmaTrackerProperties : event.tracker;
    const logger = loggerProvider.get(tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        event.status = JobStatus.Failed;
        try {
            event.statusMessage = JSON.parse(event.error.Cause).errorMessage;
        } catch (error) {
            event.statusMessage = "Unknown. Failed to parse error message";
        }

        try {
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.error("Failed to send notification");
            logger.error(error.toString());
        }
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
