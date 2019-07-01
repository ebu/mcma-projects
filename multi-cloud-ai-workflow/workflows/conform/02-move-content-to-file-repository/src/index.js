//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3()
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));

const { EnvironmentVariableProvider, Locator } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const RepositoryBucket = process.env.RepositoryBucket;

const yyyymmdd = () => {
    let now = new Date();
    let y = now.getUTCFullYear();
    let m = ("" + (now.getUTCMonth() + 1)).padStart(2, "0");
    let d = ("" + (now.getUTCDate() + 1)).padStart(2, "0");
    return y + m + d;
}

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 9;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
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
        await S3CopyObject({
            CopySource: copySource,
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    return new Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key
    });
}