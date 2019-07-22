//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));

const { EnvironmentVariableProvider, Locator, BMEssence } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;

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

    // get result of ai job
    let job = await resourceManager.resolve(jobId);
    console.log(JSON.stringify(job, null, 2));

    // Copy textToSpeech output file to output location
    let outputFile = job.jobOutput.outputFile;

    let copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);
   
    let s3Bucket = WebsiteBucket;
    let s3Key = "media/" + uuidv4();

    // add file extension
    let idxLastDot = outputFile.awsS3Key.lastIndexOf(".");
    if (idxLastDot > 0) {
        s3Key += outputFile.awsS3Key.substring(idxLastDot);
    }

    // execute copy text to speech media file
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

    let bmContent = await resourceManager.resolve(event.input.bmContent);

    // create BMEssence
    let locator = new Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key
    });

    let bmEssence = createBMEssence(bmContent, locator);
    
    // register BMEssence
    bmEssence = await resourceManager.create(bmEssence);
    if (!bmEssence.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // addin BMEssence ID
    bmContent.bmEssences.push(bmEssence.id);

    // update BMContents
    bmContent = await resourceManager.update(bmContent);

    // try {
    //     event.status = "RUNNING";
    //     event.parallelProgress = { "text-to-speech": 100 };
    //     await resourceManager.sendNotification(event);
    // } catch (error) {
    //     console.warn("Failed to send notification", error);
    // }
}
