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
        event.parallelProgress = { "detect-celebrities-aws": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.awsCelebritiesJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain awsCelebritiesJobId");
    }
    console.log("[awsCelebritiesJobId]:", jobId);

    // get result of ai job
    let response = await MCMA_CORE.HTTP.get(jobId);
    let job = response.data;
    if (!job) {
        throw new Error("Failed to obtain awsCelebritiesJobId");
    }

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

    let celebritiesMap = { };

    for (let i = 0; i < celebritiesResult.Celebrities.length;) {
        let celebrity = celebritiesResult.Celebrities[i];

        let prevCelebrity = celebritiesMap[celebrity.Celebrity.Name];
        if ((!prevCelebrity || celebrity.Timestamp - prevCelebrity.Timestamp > 3000) && celebrity.Celebrity.Confidence > 50) {
            celebritiesMap[celebrity.Celebrity.Name] = celebrity;
            i++;
        } else {
            celebritiesResult.Celebrities.splice(i, 1);
        }
    }

    console.log("AWS Celebrities result", JSON.stringify(celebritiesResult, null, 2));

    let bmContent = await retrieveResource(event.input.bmContent, "input.bmContent");

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
