//"use strict";
const AWS = require("aws-sdk");
const { EnvironmentVariableProvider, BMEssence, Locator } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));

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
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 */
function createBMEssence(bmContent, location) {
    // init bmcontent
    let bmEssence = new BMEssence({
        "bmContent": bmContent.id,
        "locations": [location],
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

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 63;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get transform job id
    let transformJobId = getTransformJobId(event);

    // in case we did note do a transcode
    if (!transformJobId) {
        return event.data.bmEssence;
    }

    // get result of transform job
    let transformJob = await resourceManager.resolve(transformJobId);

    // get media info
    let s3Bucket = transformJob.jobOutput.outputFile.awsS3Bucket;
    let s3Key = transformJob.jobOutput.outputFile.awsS3Key;

    // acquire the registered BMContent
    let bmc = await resourceManager.resolve(event.data.bmContent);

    // create BMEssence
    let locator = new Locator({
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