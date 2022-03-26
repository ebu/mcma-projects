import { Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { default as axios } from "axios";

import { Job, JobProperties, McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { buildS3Url, S3Locator } from "@mcma/aws-s3";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

import { ImageEssence, ImageTechnicalMetadata, MediaAssetProperties } from "@local/model";
import { DataController } from "@local/data";

const { MediaBucket, TableName, PublicUrl } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const s3 = new AWS.S3();

const loggerProvider = new AwsCloudWatchLoggerProvider("media-ingest-06-register-thumbnail", process.env.LogGroupName);
const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const dataController = new DataController(TableName, PublicUrl, true, new AWS.DynamoDB());

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
        createThumbnailJobId: string
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

        logger.info("Retrieving thumbnail job results");
        let job = (await resourceManager.get<Job>(event.data.createThumbnailJobId)) as JobProperties;
        logger.info(job);

        logger.info("Copying thumbnail file to final location");
        const outputFile = job.jobOutput.outputFile as S3Locator;

        const filename = outputFile.key.substring(outputFile.key.lastIndexOf("/") + 1);
        const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
        const thumbnailKey = `${event.data.mediaAssetId.substring(PublicUrl.length + 1)}/${filename}`;

        const response = await axios.get(outputFile.url, { responseType: "stream" });
        logger.info(response.headers);
        let size = Number.parseInt(response.headers["content-length"]);
        if (Number.isNaN(size)) {
            size = undefined;
        }
        const contentType = response.headers["content-type"];

        const uploadParams: AWS.S3.Types.PutObjectRequest = {
            Bucket: MediaBucket,
            Key: thumbnailKey,
            Body: response.data,
            ContentType: contentType,
        };
        await s3.upload(uploadParams).promise();

        logger.info("Creating Image Essence");
        const imageTechnicalMetadata = new ImageTechnicalMetadata({
            width: 320,
            height: 180,
            codec: "JPEG",
            aspectRatio: "16/9",
        });

        const thumbnailUrl = await buildS3Url(uploadParams.Bucket, uploadParams.Key, s3);

        const locators = [new S3Locator({ url: thumbnailUrl })];
        const tags: string[] = ["Thumbnail"];

        const imageEssence = await dataController.createMediaEssence(event.data.mediaAssetId, new ImageEssence({
            filename,
            extension,
            size,
            imageTechnicalMetadata,
            locators,
            tags,
        }));
        logger.info(imageEssence);

        const mutex = await dataController.createMutex({ name: event.data.mediaAssetId, holder: context.awsRequestId, logger });
        await mutex.lock();
        try {
            const mediaAsset = await dataController.get<MediaAssetProperties>(event.data.mediaAssetId);
            mediaAsset.thumbnailUrl = thumbnailUrl;
            await dataController.put(mediaAsset.id, mediaAsset);
        } finally {
            await mutex.unlock();
        }

        //Move this to new last step of workflow
        logger.info("Deleting media file from temp location");
        await s3.deleteObject({ Bucket: event.input.inputFile.bucket, Key: event.input.inputFile.key }).promise();
    } catch (error) {
        logger.error("Failed to register thumbnail");
        logger.error(error);
        throw new McmaException("Failed to register thumbnail", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
