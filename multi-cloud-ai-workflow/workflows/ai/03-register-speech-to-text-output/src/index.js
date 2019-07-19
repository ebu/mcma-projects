//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const { EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));

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
        event.parallelProgress = { "speech-text-translate": 40 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }


    // get ai job id (first non null entry in array)
    let jobId = event.data.transcribeJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TranscribeJobId");
    }
    console.log("[TranscribeJobId]:", jobId);

    // get result of ai job
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

    let transcriptionResult = JSON.parse(s3Object.Body.toString());
    console.log(JSON.stringify(transcriptionResult, null, 2));

    let transcripts = transcriptionResult.results.transcripts;
    console.log(JSON.stringify(transcripts, null, 2));

    let transcript = "";
    for (const ts of transcripts) {
        transcript += ts.transcript;
    }

    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    if (!bmContent.awsAiMetadata.transcription) {
        bmContent.awsAiMetadata.transcription = {}
    }
    bmContent.awsAiMetadata.transcription.original = transcript;

    await resourceManager.update(bmContent);
}
