import { Context } from "aws-lambda";

import { McmaException, McmaTracker } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-04-register-original-media", process.env.LogGroupName);

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


    } catch (error) {
        logger.error("Failed to register original media");
        logger.error(error);
        throw new McmaException("Failed to register original media", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
