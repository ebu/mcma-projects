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
        event.parallelProgress = { "detect-celebrities-aws": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.awsCelebritiesJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain awsCelebritiesJobId");
    }
    console.log("jobId", jobId);

    let job = await resourceManager.resolve(jobId);

    console.log("job", job);

    // get celebrities info 
    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to celebrities info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    let celebritiesResult = JSON.parse(s3Object.Body.toString());

    let celebritiesMap = {};
    for (const [celebrityIndex, celebrity] of celebritiesResult.entries()) {
        let prevCelebrity = celebritiesMap[celebrity.Celebrity.Name];
        if ((!prevCelebrity || celebrity.Timestamp - prevCelebrity.Timestamp > 3000) && celebrity.Celebrity.Confidence > 50) {
            celebritiesMap[celebrity.Celebrity.Name] = celebrity;
        } else {
            celebritiesResult.splice(celebrityIndex, 1);
        }
    }

    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    bmContent.awsAiMetadata.celebrities = celebritiesResult;

    await resourceManager.update(bmContent);

    try {
        event.status = "RUNNING";
        event.parallelProgress = { "detect-celebrities-aws": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }
};