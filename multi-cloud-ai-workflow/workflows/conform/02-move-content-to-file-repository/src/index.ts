import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, JobBaseProperties, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-02-move-content-to-file-repository", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const RepositoryBucket = process.env.RepositoryBucket;

const yyyymmdd = () => {
    let now = new Date();
    let y = now.getUTCFullYear();
    let m = ("" + (now.getUTCMonth() + 1)).padStart(2, "0");
    let d = ("" + (now.getUTCDate() + 1)).padStart(2, "0");
    return y + m + d;
};

type InputEvent = {
    input: {
        metadata: {
            name: string;
            description: string;
        };
        inputFile: AwsS3FileLocator;
    };
} & JobBaseProperties;

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            event.progress = 9;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        let inputFile = event.input.inputFile;

        let copySource = encodeURI(inputFile.bucket + "/" + inputFile.key);

        let s3Bucket = RepositoryBucket;
        let s3Key = yyyymmdd() + "/" + uuidv4();

        // adding file extension
        let idxLastDot = inputFile.key.lastIndexOf(".");
        if (idxLastDot > 0) {
            s3Key += inputFile.key.substring(idxLastDot);
        }

        try {
            await S3.copyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        return new AwsS3FileLocator({
            bucket: s3Bucket,
            key: s3Key
        });
    } catch (error) {
        logger.error("Failed to move content to file repository");
        logger.error(error.toString());
        throw new McmaException("Failed to move content to file repository", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
