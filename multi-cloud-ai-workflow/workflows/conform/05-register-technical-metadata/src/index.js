//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const { EnvironmentVariableProvider, BMEssence } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

/**
 * get amejob id
 * @param {*} event 
 */
function getAmeJobId(event) {
    let id;

    event.data.ameJobId.forEach(element => {
        if (element) {
            id = element;
            return true;
        }
    });

    return id;
}


/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 * @param {*} mediainfo json output from media info
 */
function createBMEssence(bmContent, location, mediainfo) {
    // init bmcontent
    let bmEssence = new BMEssence({
        bmContent: bmContent.id,
        locations: [ location ],
        technicalMetadata: mediainfo,
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
        event.progress = 36;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ame job id
    let ameJobId = getAmeJobId(event);
    if (!ameJobId) {
        throw new Error("Faild to obtain AmeJob ID");
    }
    console.log("[AmeJobID]:", ameJobId);

    // get result of ame job
    let ameJob = await resourceManager.resolve(ameJobId);

    // get media info
    let s3Bucket = ameJob.jobOutput.outputFile.awsS3Bucket;
    let s3Key = ameJob.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }
    let mediainfo = JSON.parse(s3Object.Body.toString());

    // acquire the registered BMContent
    let bmc = await resourceManager.resolve(event.data.bmContent);

    console.log("[BMContent]:", JSON.stringify(bmc, null, 2));

    // create BMEssence
    let bme = createBMEssence(bmc, event.data.repositoryFile, mediainfo);

    // register BMEssence
    bme = await resourceManager.create(bme);
    if (!bme.id) {
        throw new Error("Failed to register BMEssence.");
    }
    console.log("[BMEssence ID]:", bme.id);

    // append BMEssence ID to BMContent
    bmc.bmEssences.push(bme.id);

    // update BMContents
    bmc = await resourceManager.update(bmc);

    // return the URL to the BMEssense
    return bme.id;
}