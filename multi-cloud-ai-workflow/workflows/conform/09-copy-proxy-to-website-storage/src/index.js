//"use strict";

// require
const util = require("util");
const uuidv4 = require('uuid/v4');

const AWS = require("aws-sdk");
const S3 = new AWS.S3()
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const WEBSITE_BUCKET = process.env.WEBSITE_BUCKET;

const yyyymmdd = () => {
    let now = new Date();
    let y = now.getUTCFullYear();
    let m = ('' + (now.getUTCMonth() + 1)).padStart(2, '0');
    let d = ('' + (now.getUTCDate() + 1)).padStart(2, '0');
    return y + m + d;
}

/**
 * get amejob id
 * @param {*} event 
 */
function getTransformJobId(event) {
    let id;

    event.data.transformJob.forEach(element => {
        if (element) {
            id = element;
            return true;
        }
    });

    return id;
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
    if(!transformJobId) {
        throw new Error("Faild to obtain TransformJob ID");
    }

    // get result of transform job
    let response = await MCMA_CORE.HTTP.get(transformJobId);
    if(!response.data) {
        throw new Error("Faild to obtain TransformJob");
    }

    let transformJob = response.data;

    // copy proxy to website storage
    let outputFile = transformJob.jobOutput.outputFile;
    let copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);

    let s3Bucket = WEBSITE_BUCKET;
    let s3Key = yyyymmdd() + "/" + uuidv4();

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

    // addin ResultPath of StepFunctions
    return new MCMA_CORE.Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key
    });
}