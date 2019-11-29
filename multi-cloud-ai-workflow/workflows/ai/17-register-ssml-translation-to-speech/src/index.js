//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));

const { EnvironmentVariableProvider, Locator, BMEssence } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;
const RepositoryBucket = process.env.RepositoryBucket;
const TempBucket = process.env.TempBucket;

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
        event.parallelProgress = { "ssml-translation-to-speech": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.ssmlTextToSpeechJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain ssmlTranslationToSpeechJobId");
    }
    console.log("[SsmlTextToSpeechJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);
    console.log(JSON.stringify(job, null, 2));

    // Copy ssmlTextToSpeech output file to output location
    let outputFile = job.jobOutput.outputFile;

    // destination bucket: AIJob outputlocation
    let s3Bucket = outputFile.awsS3Bucket;
    let s3Key = outputFile.awsS3Key;

    // identify associated bmContent
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    // construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    // console.log(JSON.stringify(data, null, 2));
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";

    // update BMContents with reference to text-to-speech output source file
    bmContent = await resourceManager.update(bmContent);

    // source URI already defined
    let copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);

    // destination bucket - temp for ffmpeg assembly
    let s3Bucket_temp = TempBucket;
    let s3Key_temp = "temp/ssmlTranslation.mp3";
    try {
        let params_temp = {
            CopySource: copySource,
            Bucket: s3Bucket_temp,
            Key: s3Key_temp,
        };
        await S3CopyObject(params_temp);
    } catch (error) {
        throw new Error("Unable to read input file in bucket '" + s3Bucket_temp + "' with key '" + s3Key_temp + "' due to error: " + error.message);
    }
 
    // destination bucket - website bucket
    let s3Bucket_web = WebsiteBucket;
    let s3Key_web = "media/ssmlTranslation/ssmlTranslation.mp3";
    try {
        let params_web = {
            CopySource: copySource,
            Bucket: s3Bucket_web,
            Key: s3Key_web,
        };
        await S3CopyObject(params_web);
    } catch (error) {
        throw new Error("Unable to read input file in bucket '" + s3Bucket_web + "' with key '" + s3Key_web + "' due to error: " + error.message);
    }

    let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket_web + "/" + s3Key_web;

    // create BMEssence corresponding to speechToText media file in websiteBucket
    // bmEssence is a locator to the essence and the associated bmContent
    let locator_web = new Locator({
        "awsS3Bucket": s3Bucket_web,
        "awsS3Key": s3Key_web,
        "httpEndpoint": httpEndpoint_web
    });

    let bmEssence_web = createBMEssence(bmContent, locator_web, "ssml-text-to-speech-web", "ssml-text-to-speech-web");
   
    // register BMEssence to obtain bmEssence Id to provide link in bmContent
    bmEssence_web = await resourceManager.create(bmEssence_web);
    if (!bmEssence_web.id) {
        throw new Error("Failed to register BMEssence_web.");
    }

    // add BMEssence ID reference in bmContent array of bmEssences
    bmContent.bmEssences.push(bmEssence_web.id);

    // update BMContents with reference to text-to-speech website bucket copy file
    bmContent = await resourceManager.update(bmContent);

    // adding ResultPath of StepFunctions -> CHECK USAGE!!!!!!!!!!!! WITH WEBSITE??
    return new Locator({
        awsS3Bucket: s3Bucket_web,
        awsS3Key: s3Key_web,
//       httpEndpoint: httpEndpoint
    });

}
