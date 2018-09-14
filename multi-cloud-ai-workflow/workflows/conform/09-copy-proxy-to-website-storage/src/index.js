//"use strict";

// require
const util = require("util");
const uuidv4 = require('uuid/v4');

const AWS = require("aws-sdk");
const S3 = new AWS.S3()
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const WEBSITE_BUCKET = process.env.WEBSITE_BUCKET;

/**
 * get amejob id
 * @param {*} event 
 */
function getTransformJobId(event) {
    let id;

    if (event.data.transformJob) {
        event.data.transformJob.forEach(element => {
            if (element) {
                id = element;
                return true;
            }
        });
    }

    return id;
}

/**
 * get the registered BMEssence
 */
getBMEssence = async (url) => {

    let response = await MCMA_CORE.HTTP.get(url);

    if (!response.data) {
        throw new Error("Faild to obtain BMEssence");
    }

    return response.data;
}

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
        event.progress = 72;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get transform job id
    let transformJobId = getTransformJobId(event);
    // in case we did note do a transcode
    let response;
    let outputFile;
    let copySource;
    if (!transformJobId) {
        let bme = await getBMEssence(event.data.bmEssence);
        // copy proxy to website storage
        outputFile = bme.locations[0];
        copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);

    } else {
        // get result of transform job
        response = await MCMA_CORE.HTTP.get(transformJobId);
        if (!response.data) {
            throw new Error("Faild to obtain TransformJob");
        }

        let transformJob = response.data;

        // copy proxy to website storage
        outputFile = transformJob.jobOutput.outputFile;
        copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);
    }

    let s3Bucket = WEBSITE_BUCKET;
    let s3Key = "media/" + uuidv4();

    // addin file extension
    let idxLastDot = outputFile.awsS3Key.lastIndexOf(".");
    if (idxLastDot > 0) {
        s3Key += outputFile.awsS3Key.substring(idxLastDot);
    }

    // execute copy proxy
    try {
        let params = {
            CopySource: copySource,
            Bucket: s3Bucket,
            Key: s3Key,
        };
        await S3CopyObject(params);
    } catch (error) {
        throw new Error("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    // construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    console.log(JSON.stringify(data, null, 2));
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
    mediaFileUrl = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;

    // addin ResultPath of StepFunctions
    return new MCMA_CORE.Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key,
        "httpEndpoint": httpEndpoint
    });
}