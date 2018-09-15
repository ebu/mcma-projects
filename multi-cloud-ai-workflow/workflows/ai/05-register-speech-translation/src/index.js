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
        event.parallelProgress = { "speech-text-translate": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }


    // get ai job id (first non null entry in array)
    let jobId = event.data.translateJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TranslationJobId");
    }
    console.log("[TranslationJobId]:", jobId);

    // get result of ai job
    let response = await MCMA_CORE.HTTP.get(jobId);
    let job = response.data;
    if (!job) {
        throw new Error("Failed to obtain TranslationJob");
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

    let translationResult = s3Object.Body.toString();
    console.log("Translation result", translationResult);

    let bmContent = await retrieveResource(event.input.bmContent, "input.bmContent");

    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    if (!bmContent.awsAiMetadata.transcription) {
        bmContent.awsAiMetadata.transcription = {}
    }
    bmContent.awsAiMetadata.transcription.translation = translationResult;

    await resourceManager.update(bmContent);

    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }
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
