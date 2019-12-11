//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider, BMEssence } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-05-register-technical-metadata", process.env.LogGroupName);

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
        locations: [location],
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
    const logger = loggerProvider.get(event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            event.progress = 36;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ame job id
        let ameJobId = getAmeJobId(event);
        if (!ameJobId) {
            throw new Exception("Faild to obtain AmeJob ID");
        }
        logger.info("[AmeJobID]:", ameJobId);

        // get result of ame job
        let ameJob = await resourceManager.get(ameJobId);

        // get media info
        let s3Bucket = ameJob.jobOutput.outputFile.awsS3Bucket;
        let s3Key = ameJob.jobOutput.outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }
        let mediainfo = JSON.parse(s3Object.Body.toString());

        // acquire the registered BMContent
        let bmc = await resourceManager.get(event.data.bmContent);

        logger.info("[BMContent]:", JSON.stringify(bmc, null, 2));

        // create BMEssence
        let bme = createBMEssence(bmc, event.data.repositoryFile, mediainfo);

        // register BMEssence
        bme = await resourceManager.create(bme);
        if (!bme.id) {
            throw new Exception("Failed to register BMEssence.");
        }
        logger.info("[BMEssence ID]:", bme.id);

        // append BMEssence ID to BMContent
        bmc.bmEssences.push(bme.id);

        // update BMContents
        bmc = await resourceManager.update(bmc);

        // return the URL to the BMEssense
        return bme.id;
    } catch (error) {
        logger.error("Failed to register technical metadata");
        logger.error(error.toString());
        throw new Exception("Failed to register technical metadata", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
