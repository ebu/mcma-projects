//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const { EnvironmentVariableProvider } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {

    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
    console.log('context', context);
    console.log('event', event);
    console.log('event.data', event.data);

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "detect-emotions-aws": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.awsEmotionsJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain awsEmotionsJobId");
    }
    console.log("jobId", jobId);

    let job = await resourceManager.resolve(jobId);

    // get emotions info 
    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to emotions info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    let emotionsResult = JSON.parse(s3Object.Body.toString());

    // console.log("emotionsResult[0]: ", JSON.stringify(emotionsResult[0], null, 2));

    // returning here as we probably should not attach the whole metadata file to the bmContent.
    return;

    // let bmContent = await resourceManager.resolve(event.input.bmContent);
    //
    // if (!bmContent.awsAiMetadata) {
    //     bmContent.awsAiMetadata = {};
    // }
    // bmContent.awsAiMetadata.emotions = emotionsResult;
    //
    // await resourceManager.update(bmContent);
    //
    // try {
    //     event.status = "RUNNING";
    //     event.parallelProgress = { "detect-emotions-aws": 100 };
    //     await resourceManager.sendNotification(event);
    // } catch (error) {
    //     console.warn("Failed to send notification", error);
    // }
};
