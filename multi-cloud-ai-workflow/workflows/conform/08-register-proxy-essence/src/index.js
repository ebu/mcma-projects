//"use strict";
const AWS = require("aws-sdk");

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-08-register-proxy-essence", process.env.LogGroupName);

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

        // get transform job id
        let transformJobId = getTransformJobId(event);

        // in case we did note do a transcode
        if (!transformJobId) {
            return event.data.bmEssence;
        }

        // get result of transform job
        let transformJob = await resourceManager.get(transformJobId);

        // get media info
        let s3Bucket = transformJob.jobOutput.outputFile.awsS3Bucket;
        let s3Key = transformJob.jobOutput.outputFile.awsS3Key;

        // acquire the registered BMContent
        let bmc = await resourceManager.get(event.data.bmContent);

        // create BMEssence
        let locator = new Locator({
            "awsS3Bucket": s3Bucket,
            "awsS3Key": s3Key
        });

        let bme = createBMEssence(bmc, locator, "proxy-source", "proxy-source");
//    let bme = createBMEssence(bmc, locator);

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
    } catch (error) {
        logger.error("Failed to register proxy essence");
        logger.error(error.toString());
        throw new Exception("Failed to register proxy essence", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
