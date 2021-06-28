import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { McmaException, McmaTracker, NotificationEndpointProperties } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator } from "@mcma/aws-s3";

const S3 = new AWS.S3();

const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-01-validate-workflow-input", process.env.LogGroupName);

// Expecting input like the following:
// {
//     "input": {
//         "metadata": {
//             "@type": "DescriptiveMetadata",
//             "name": "Cat video",
//             "description": "Great video of cats"
//         },
//         "inputFile": {
//             "@type": "Locator",
//             "bucket": "bucket_name",
//             "key": "key_name"
//         }
//     },
//     "notificationEndpoint": {
//         "@type": "NotificationEndpoint",
//         "httpEndpoint": "http://workflow-service/job-assignments/34543-34-534345-34/notifications"
//     }
// }
//
// Note that the notification endpoint is optional. But is used to notify progress and completed/failed of workflow.

type InputEvent = {
    input: {
        metadata: {
            name: string
            description: string
        }
        inputFile: AwsS3FileLocator
    }
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
            event.progress = 0;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // checking input
        if (!event || !event.input) {
            throw new McmaException("Missing workflow input");
        }

        let input = event.input;

        if (!input.metadata) {
            throw new McmaException("Missing input.metadata");
        }

        if (!input.metadata.name) {
            throw new McmaException("Missing input.metadata.name");
        }

        if (input.metadata.description === undefined || input.metadata.description === null) {
            throw new McmaException("Missing input.metadata.description");
        }

        if (!input.inputFile) {
            throw new McmaException("Missing input.inputFile");
        }

        let s3Bucket = input.inputFile.bucket;
        let s3Key = input.inputFile.key;

        let data;

        try {
            data = await S3.headObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        return data;
    } catch (error) {
        logger.error("Failed to validate workflow input");
        logger.error(error.toString());
        throw new McmaException("Failed to validate workflow input", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
