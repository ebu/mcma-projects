//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider, BMEssence } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FileLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-19-register-dubbing-srt", process.env.LogGroupName);

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

        // send update notification
        try {
            event.progress = 63;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        let jobId = event.data.dubbingSrtJobId.find(id => id);
        if (!jobId) {
            throw new Exception("Failed to obtain ssmlTranslationToSpeechJobId");
        }
        logger.info("[DubbingSrtJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get(jobId);
        logger.info(JSON.stringify(job, null, 2));

        let outputFile = job.jobOutput.outputFile;

        // destination bucket: AIJob outputlocation
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;

        // construct public https endpoint
        let data = await S3.getBucketLocation({ Bucket: s3Bucket }).promise();
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
        let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;

        // acquire the registered BMContent
        let bmc = await resourceManager.get(event.input.bmContent);

        // create BMEssence
        let locator = new AwsS3FileLocator({
            "awsS3Bucket": s3Bucket,
            "awsS3Key": s3Key,
            "httpEndpoint": httpEndpoint_web
        });

        let bme = createBMEssence(bmc, locator, "dubbing-srt-output", "dubbing-srt-output");

        // register BMEssence
        bme = await resourceManager.create(bme);
        if (!bme.id) {
            throw new Exception("Failed to register BMEssence.");
        }

        // addin BMEssence ID
        bmc.bmEssences.push(bme.id);

        // update BMContents
        bmc = await resourceManager.update(bmc);

        // the URL to the BMEssence with dubbed audio file and srt
        return bme.id;
    } catch (error) {
        logger.error("Failed to register dubbing SRT");
        logger.error(error.toString());
        throw new Exception("Failed to register dubbing SRT", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
