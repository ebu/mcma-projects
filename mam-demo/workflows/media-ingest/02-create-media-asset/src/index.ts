import { Context } from "aws-lambda";

import { McmaException, McmaTracker } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-02-create-media-asset", process.env.LogGroupName);

type InputEvent = {
    input?: {
        inputFile?: S3Locator
    }
    tracker?: McmaTracker
}

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        throw new McmaException("Not Implemented");

    } catch (error) {
        logger.error("Failed to create media asset");
        logger.error(error);
        throw new McmaException("Failed to create media asset", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
