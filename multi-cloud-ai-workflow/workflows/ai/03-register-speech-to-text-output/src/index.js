//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 40 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }


    // get ai job id (first non null entry in array)
    let jobId = event.data.transcribeJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TranscribeJobId");
    }
    console.log("[TranscribeJobId]:", jobId);

    // get result of ai job
    let response = await MCMA_CORE.HTTP.get(jobId);
    let job = response.data;
    if (!job) {
        throw new Error("Failed to obtain TranscribeJob");
    }

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

    let bmContent = await retrieveResource(event.input.bmContent, "input.bmContent");
    
    console.log("[BMContent]:", JSON.stringify(bmContent, null, 2));
    
    let awsAiMetadata = bmContent.awsAiMetadata || {};
    awsAiMetadata.transcription = { original: transcript };
    bmContent.awsAiMetadata = awsAiMetadata;

    await resourceManager.update(bmContent);

    console.log("Updated BMContent:", JSON.stringify(bmContent, null, 2));
}

const retrieveResource = async (resource, resourceName) => {
    let type = typeof resource;

    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    if (type === "string") {  // if type is a string we assume it's a URL.
        try {
            let response = await MCMA_CORE.HTTP.get(resource);
            resource = response.data;
        } catch (error) {
            throw new Error("Failed to retrieve '" + resourceName + "' from url '" + resource + "'");
        }
    }

    type = typeof resource;

    if (type === "object") {
        if (Array.isArray(resource)) {
            throw new Error(resourceName + " has illegal type 'Array'");
        }

        return resource;
    } else {
        throw new Error(resourceName + " has illegal type '" + type + "'");
    }
}
