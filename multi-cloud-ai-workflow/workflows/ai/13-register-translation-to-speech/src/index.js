//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const { EnvironmentVariableProvider } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

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
        event.parallelProgress = { "text-to-speech": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.textToSpeechJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TextToSpeechJobId");
    }
    console.log("[TextToSpeechJobId]:", jobId);


    // get transform job id
    let textToSpeechJobId = gettextToSpeechJobId(event);

    // in case we did note do a transcode
    if (!textToSpeecjJobId) {
        return event.data.bmEssence;
    }

    // get result of transform job
    let textToSpeechJob = await resourceManager.resolve(textToSpeechJobId);

    // get media info
    let s3Bucket = textToSpeechJob.jobOutput.outputFile.awsS3Bucket;
    let s3Key = textToSpeechJob.jobOutput.outputFile.awsS3Key;


    // get media info
    let s3Bucket = textToSpeechJob.jobOutput.outputFile.awsS3Bucket;
    let s3Key = textToSpeechJob.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

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

    try {
        event.status = "RUNNING";
        event.parallelProgress = { "text-to-speech": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }
}
