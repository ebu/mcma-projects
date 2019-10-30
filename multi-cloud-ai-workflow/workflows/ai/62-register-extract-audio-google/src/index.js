//"use strict";

// require
const util = require("util");


const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));

const { EnvironmentVariableProvider, BMEssence, Locator } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

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

    let jobId = event.data.extractAudioJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain extractAudioJobId");
    }
    console.log("[ExtractAudioJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);
    console.log(JSON.stringify(job, null, 2));

    let outputFile = job.jobOutput.outputFile;
    console.log("outputFile:", outputFile);

    // destination bucket: AIJob outputlocation
    let s3Bucket = outputFile.awsS3Bucket;
    let s3Key = outputFile.awsS3Key;
    console.log("s3Bucket:", s3Bucket);
    console.log("s3Key:", s3Key);

// construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
    let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;
    let mediaFileUri = "https://" + s3SubDomain + ".amazonaws.com/" + outputFile.awsS3Bucket + "/" + outputFile.awsS3Key;
    console.log("httpEndpoint_web", httpEndpoint_web);
    console.log("mediaFileUri", mediaFileUri);




    // acquire the registered BMContent
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    /*if (!bmContent.googleAiMetadata) {
        bmContent.googleAiMetadata = {};
    }

    bmContent.googleAiMetadata.transcription = transcription;*/

    // create BMEssence
    let locator = new Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key,
        "httpEndpoint": httpEndpoint_web
    });

    let bmEssence = createBMEssence(bmContent, locator, "audio-google", "audio-google");

    // register BMEssence
    bmEssence = await resourceManager.create(bmEssence);
    if (!bmEssence.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // addin BMEssence ID
    bmContent.bmEssences.push(bmEssence.id);
    console.log("bmContent", bmContent);

    // update BMContents
    bmContent = await resourceManager.update(bmContent);
    console.log("bmContent", bmContent);

    // the URL to the BMEssence with dubbed audio file and srt
    return bmEssence.id;
}