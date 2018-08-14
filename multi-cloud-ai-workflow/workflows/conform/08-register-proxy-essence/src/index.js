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
        event.progress = 63;
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

    // get media info
    let s3Bucket = response.data.jobOutput.outputFile.awsS3Bucket;
    let s3Key = response.data.jobOutput.outputFile.awsS3Key;

    // create BMEssence
    let bme = {
        "@type": "BMEssence",
        "label": "proxy",
        "ebucore:locator": [
            {
                "key": "s3.temp",
                "value": "https://" + s3Bucket + ".s3.amazonaws.com/" + s3Key
            }
        ]
    };

    // register BMEssence
    bme = await resourceManager.create(bme);
    if (!bme.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // get BMContent
    response = await MCMA_CORE.HTTP.get(event.data.assets);
    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }

    // addin BMEssence ID
    let bmc = response.data;
    bmc["ebucore:hasRelatedResource"].push({ "@id": bme.id });

    // update BMContents
    bmc = await resourceManager.update(bmc);

    // addin ResultPath of StepFunctions
    return bmc.id;

}