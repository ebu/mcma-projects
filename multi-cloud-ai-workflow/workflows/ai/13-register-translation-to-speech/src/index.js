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

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "text-to-speech": 80 };
//        event.parallelProgress = { "translation-to-speech": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.textToSpeechJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TextToSpeechJobId");
    }
    console.log("[TextToSpeechJobId]:", jobId);

    let job = await resourceManager.resolve(jobId);

    // get media info
    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

//    let translationResult = s3Object.Body.toString();
//    console.log("Translation result", translationResult);

    let bmEssence = await resourceManager.resolve(event.input.bmEssence);

//    if (!bmContent.awsAiMetadata) {
//        bmContent.awsAiMetadata = {};
//    }
//    if (!bmContent.awsAiMetadata.transcription) {
//        bmContent.awsAiMetadata.transcription = {}
//    }
//    bmContent.awsAiMetadata.transcription.translation = translationResult;

    await resourceManager.update(bmEssence);

    try {
        event.status = "RUNNING";
  //      event.parallelProgress = { "translation-to-speech": 100 };
        event.parallelProgress = { "text-to-speech": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }
}
