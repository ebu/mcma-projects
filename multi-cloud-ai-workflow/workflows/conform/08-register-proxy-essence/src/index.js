//"use strict";

// require
const util = require("util");
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * get amejob id
 * @param {*} event 
 */
function getTransformJobId(event) {
    let id;

    if( event.data.transformJob ) {
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
 * get the registered BMContent
 */
getBMContent = async(url) => {

    let response = await MCMA_CORE.HTTP.get(url);

    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }

    return response.data;
}

/**
 * get the registered BMEssence
 */
getBMEssence = async(url) => {

    let response = await MCMA_CORE.HTTP.get(url);

    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }

    return response.data;
}

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 */
function createBMEssence(bmContent, location) {
    // init bmcontent
    let bmEssence = new MCMA_CORE.BMEssence({
        "bmContent": bmContent.id,
        "locations": [ location ],
    });
    return bmEssence;
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
        event.progress = 63;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get transform job id
    let transformJobId = getTransformJobId(event);

    // in case we did note do a transcode
    if(!transformJobId) {
        return event.data.bmEssence;
    }

    // get result of transform job
    let response = await MCMA_CORE.HTTP.get(transformJobId);
    if(!response.data) {
        throw new Error("Faild to obtain TransformJob");
    }

    // get media info
    let s3Bucket = response.data.jobOutput.outputFile.awsS3Bucket;
    let s3Key = response.data.jobOutput.outputFile.awsS3Key;

    // acquire the registered BMContent
    let bmc = await getBMContent(event.data.bmContent);

    // create BMEssence
    let locator = new MCMA_CORE.Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key
    });

    let bme = createBMEssence(bmc, locator);

    // register BMEssence
    bme = await resourceManager.create(bme);
    if (!bme.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // addin BMEssence ID
    bmc.bmEssences.push(bme.id);

    // update BMContents
    bmc = await resourceManager.update(bmc);

    // the URL to the BMEssence with conformed media
    return bme.id;
}