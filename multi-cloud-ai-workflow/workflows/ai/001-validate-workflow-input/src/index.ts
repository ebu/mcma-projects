import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";

import { EnvironmentVariableProvider, JobBaseProperties, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { getS3Url } from "@mcma/aws-s3";

import { BMContent, BMEssence, getAwsS3FileLocations } from "@local/common";

const S3 = new AWS.S3();

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-001-validate-workflow-input", process.env.LogGroupName);

/* Expecting input like the following:

 {
 "input": {
 "bmContent": https://urlToBmContent,
 "bmEssence": https://urlToBmEssence
 },
 "notificationEndpoint": {
 "@type": "NotificationEndpoint",
 "httpEndpoint": "http://workflow-service/job-assignments/34543-34-534345-34/notifications"
 }
 }

 Note that the notification endpoint is optional. But is used to notify progress and completed/failed of workflow.
 */

type InputEvent = {
    input: {
        bmContent?: string,
        bmEssence?: string
    }
} & JobBaseProperties;

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
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // check the input and return mediaFileLocator which service as input for the AI workflows
        if (!event || !event.input) {
            throw new Error("Missing workflow input");
        }

        let input = event.input;

        if (!input.bmContent) {
            throw new Error("Missing input.bmContent");
        }

        if (!input.bmEssence) {
            throw new Error("Missing input.bmEssence");
        }

        let bmContent = await resourceManager.get<BMContent>(input.bmContent);
        let bmEssence = await resourceManager.get<BMEssence>(input.bmEssence);

        logger.info(bmContent);
        logger.info(bmEssence);

        let mediaFileLocator;

        // find the media locator in the website bucket with public httpEndpoint
        for (const locator of getAwsS3FileLocations(bmEssence)) {
            if (locator.bucket === WebsiteBucket) {
                mediaFileLocator = locator;
            }
        }

        if (!mediaFileLocator) {
            throw new McmaException("No suitable Locator found on bmEssence");
        }

        await getS3Url(mediaFileLocator, S3);

        return mediaFileLocator;
    } catch (error) {
        logger.error("Failed to validate workflow input");
        logger.error(error.toString());
        throw new McmaException("Failed to validate workflow input", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
