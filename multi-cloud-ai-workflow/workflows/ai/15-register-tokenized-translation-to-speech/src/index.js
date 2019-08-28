//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3GetObject = util.promisify(S3.getObject.bind(S3));


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
        event.parallelProgress = { "tokenized-text-to-speech": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.tokenizedTextToSpeechJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TextToSpeechJobId");
    }
    console.log("[TokenizedTextToSpeechJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);
    console.log(JSON.stringify(job, null, 2));

    // Copy textToSpeech output file to output location
    let outputFile = job.jobOutput.outputFile;

    // get object from location bucket+key(prefix+filename)
    let s3Bucket_ssml = outputFile.awsS3Bucket;
    let s3Key_ssml = outputFile.awsS3Key;
    let s3Object_ssml;
    try {
        s3Object_ssml = await S3GetObject({
            Bucket: s3Bucket_ssml,
            Key: s3Key_ssml,
        });
    } catch (error) {
        throw new Error("Unable to copy ssml file in bucket '" + s3Bucket_ssml + "' with key '" + s3Key_ssml + "' due to error: " + error.message);
    }

    // identify associated bmContent
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    // attach ssml of translation text to bmContent property translation 
    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    if (!bmContent.awsAiMetadata.transcription) {
        bmContent.awsAiMetadata.transcription = {}
    }
    bmContent.awsAiMetadata.transcription.ssmlTranslation = s3Object_ssml.Body.toString();

    // update BMContents with reference to text-to-speech output source file
    bmContent = await resourceManager.update(bmContent);


}
