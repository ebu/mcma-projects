import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";

import { McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";

import { MediaAsset, MediaAssetWorkflow, MediaWorkflowProperties } from "@local/model";
import { DataController } from "@local/data";

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const { TableName, PublicUrl } = process.env;

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-02-create-media-asset", process.env.LogGroupName);
const dataController = new DataController(TableName, PublicUrl, true, new AWS.DynamoDB());

type InputEvent = {
    input: {
        mediaWorkflowId: string
        title: string
        description: string
        inputFile: S3Locator
    }
    tracker?: McmaTracker
    notificationEndpoint: NotificationEndpointProperties
}

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const mediaAsset = await dataController.createMediaAsset(new MediaAsset({
            title: event.input.title,
            description: event.input.description
        }));

        const mutex = await dataController.createMutex({ name: event.input.mediaWorkflowId, holder: context.awsRequestId, logger });
        await mutex.lock();
        try {
            const mediaWorkflow = await dataController.get<MediaWorkflowProperties>(event.input.mediaWorkflowId);

            const mediaAssetWorkflow = await dataController.createMediaAssetWorkflow(mediaAsset.id, new MediaAssetWorkflow({
                mediaWorkflowId: mediaWorkflow.id,
                mediaWorkflowType: mediaWorkflow.type,
                data: {}
            }));

            mediaWorkflow.mediaAssetId = mediaAsset.id;
            mediaWorkflow.mediaAssetWorkflowId = mediaAssetWorkflow.id;

            await dataController.put(mediaWorkflow.id, mediaWorkflow);

            return {
                mediaAssetId: mediaAsset.id,
                mediaAssetWorkflowId: mediaAssetWorkflow.id,
            };
        } finally {
            await mutex.unlock();
        }
    } catch (error) {
        logger.error("Failed to create media asset");
        logger.error(error);
        throw new McmaException("Failed to create media asset", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
