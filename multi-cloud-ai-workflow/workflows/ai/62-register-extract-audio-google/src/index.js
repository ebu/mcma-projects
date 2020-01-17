//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider, BMEssence } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-62-register-extract-audio-google", process.env.LogGroupName);

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
    const logger = loggerProvider.get(event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        let jobId = event.data.extractAudioJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain extractAudioJobId");
        }
        logger.info("[ExtractAudioJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get(jobId);
        logger.info(JSON.stringify(job, null, 2));

        let outputFile = job.jobOutput.outputFile;
        logger.info("outputFile:", outputFile);

        // destination bucket: AIJob outputlocation
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;
        logger.info("s3Bucket:", s3Bucket);
        logger.info("s3Key:", s3Key);

// construct public https endpoint
        let data = await S3.getBucketLocation({ Bucket: s3Bucket }).promise();
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
        let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;
        let mediaFileUri = "https://" + s3SubDomain + ".amazonaws.com/" + outputFile.awsS3Bucket + "/" + outputFile.awsS3Key;
        logger.info("httpEndpoint_web", httpEndpoint_web);
        logger.info("mediaFileUri", mediaFileUri);

        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        logger.info("s3Object.Body.toString()", s3Object.Body.toString());

        let transcription = s3Object.Body.toString();

        // acquire the registered BMContent
        let bmContent = await resourceManager.get(event.input.bmContent);

        if (!bmContent.googleAiMetadata) {
            bmContent.googleAiMetadata = {};
        }

        bmContent.googleAiMetadata.transcription = transcription;

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
            throw new Exception("Failed to register BMEssence.");
        }

        // addin BMEssence ID
        bmContent.bmEssences.push(bmEssence.id);
        logger.info("bmContent", bmContent);

        // update BMContents
        bmContent = await resourceManager.update(bmContent);
        logger.info("bmContent", bmContent);

        // the URL to the BMEssence with dubbed audio file and srt
        return bmEssence.id;
    } catch (error) {
        logger.error("Failed to register extract audio google");
        logger.error(error.toString());
        throw new Exception("Failed to register extract audio google", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
