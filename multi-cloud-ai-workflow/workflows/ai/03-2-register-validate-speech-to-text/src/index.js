//"use strict";

// require
const fs = require('fs');
const util = require("util");

const fsWriteFile = util.promisify(fs.writeFile);
const CreateReadStream = util.promisify(fs.createReadStream);
const CreateWriteStream = util.promisify(fs.createWriteStream);

const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const srtConvert = require("aws-transcription-to-srt");
const Subtitle = require("subtitle-utils");

const { EnvironmentVariableProvider, Locator, BMEssence } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;
const RepositoryBucket = process.env.RepositoryBucket;


/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the text file / essence containing the conversion of the transcription to srt
 * @param {*} title of the bmEssence
 * @param {*} description of the bmEssence
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
//    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 40 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }


    // get ai job id (first non null entry in array)
    let jobId = event.data.transcribeJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TranscribeJobId");
    }
//    console.log("[TranscribeJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);

    // get previous process output object
/*    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }
*/

///////////////////////////////////////////////////////////////////////////////
// ASSOCIATION OF WORDDIFFS AND WORDERRORRATE RESULTS DIRECTLY WITH BMCONTENT PROPERTIES
///////////////////////////////////////////////////////////////////////////////
/*    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    if (!bmContent.awsAiMetadata.transcription) {
        bmContent.awsAiMetadata.transcription = {}
    }

    // associate wordiffs with bm Content 
    bmContent.awsSrt.transcription.worddiffs = worddiffs;
    console.log(bmContent.awsSrt.transcription.worddiffs);

    // associate word error rate with bm Content 
    bmContent.awsSrtClean.transcription.worderrorrate = worderrorrate;
    console.log(bmContent.awsSrtClean.transcription.worderrorrate);

    bmContent = await resourceManager.update(bmContent);
*/
}
