//"use strict";
const uuidv4 = require("uuid/v4");
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FileLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
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

exports.handler = async (event, context) => {
    const logger = loggerProvider.get(event.tracker);
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

        let copySource = encodeURI(inputFile.awsS3Bucket + "/" + inputFile.awsS3Key);

        let s3Bucket = RepositoryBucket;
        let s3Key = yyyymmdd() + "/" + uuidv4();

        // adding file extension
        let idxLastDot = inputFile.awsS3Key.lastIndexOf(".");
        if (idxLastDot > 0) {
            s3Key += inputFile.awsS3Key.substring(idxLastDot);
        }

        try {
            await S3.copyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        return new AwsS3FileLocator({
            "awsS3Bucket": s3Bucket,
            "awsS3Key": s3Key
        });
    } catch (error) {
        logger.error("Failed to move content to file repository");
        logger.error(error.toString());
        throw new Exception("Failed to move content to file repository", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
