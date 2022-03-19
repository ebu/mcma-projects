import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";

import {
    TransformJob,
    JobParameterBag,
    JobProfile,
    McmaException,
    McmaTracker,
    NotificationEndpoint,
    NotificationEndpointProperties
} from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

const { ActivityArn } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const stepFunctions = new AWS.StepFunctions();
const s3 = new AWS.S3({ signatureVersion: "v4" });

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-05-create-thumbnail", process.env.LogGroupName);
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));

type InputEvent = {
    input: {
        mediaWorkflowId: string
        title: string
        description: string
        inputFile: S3Locator
    }
    data: {
        mediaAssetId: string
        mediaAssetWorkflowId: string
        technicalMetadataJobId: string
        createWebVersion: boolean
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

        const data = await stepFunctions.getActivityTask({ activityArn: ActivityArn }).promise();
        logger.info(data);

        const taskToken = data.taskToken;
        if (!taskToken) {
            throw new McmaException("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);

        const notificationUrl = event.notificationEndpoint.httpEndpoint + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info(`NotificationUrl: ${notificationUrl}`);

        const [jobProfile] = await resourceManager.query(JobProfile, { name: "ExtractThumbnail" });
        if (!jobProfile) {
            throw new McmaException("JobProfile 'ExtractThumbnail' not found.");
        }

        const inputFile = event.input.inputFile;
        inputFile.url = s3.getSignedUrl("getObject", {
            Bucket: inputFile.bucket,
            Key: inputFile.key,
            Expires: 3600
        });

        let job = new TransformJob({
            jobProfileId: jobProfile.id,
            jobInput: new JobParameterBag({
                inputFile
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            }),
            tracker: event.tracker
        });

        logger.info("Creating job...");
        job = await resourceManager.create(job);

        logger.info(job);

    } catch (error) {
        logger.error("Failed to create thumbnail");
        logger.error(error);
        throw new McmaException("Failed to create thumbnail", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
