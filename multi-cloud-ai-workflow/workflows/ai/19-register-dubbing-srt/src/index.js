//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));

const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));

const { EnvironmentVariableProvider, BMEssence, Locator } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;


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
 * @param {*} title of the media file
 * @param {*} description of the media file
 */
function createBMEssence(bmContent, location, title, description) {
    // init bmcontent
    let bmEssence = new BMEssence({
        "bmContent": bmContent.id,
        "locations": [location],
        "title": title,
        "description": description,
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

    let jobId = event.data.dubbingSrtJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain ssmlTranslationToSpeechJobId");
    }
    console.log("[DubbingSrtJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);
    console.log(JSON.stringify(job, null, 2));

    let outputFile = job.jobOutput.outputFile;

    // destination bucket: AIJob outputlocation
    let s3Bucket = outputFile.awsS3Bucket;
    let s3Key = outputFile.awsS3Key;

    // construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
    let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;

    // acquire the registered BMContent
    let bmc = await resourceManager.resolve(event.input.bmContent);

    // create BMEssence
    let locator = new Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key,
        "httpEndpoint": httpEndpoint_web
    });

    let bme = createBMEssence(bmc, locator, "dubbing-srt-output", "dubbing-srt-output");

    // register BMEssence
    bme = await resourceManager.create(bme);
    if (!bme.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // addin BMEssence ID
    bmc.bmEssences.push(bme.id);

    // update BMContents
    bmc = await resourceManager.update(bmc);

    // the URL to the BMEssence with dubbed audio file and srt
    return bme.id;
}