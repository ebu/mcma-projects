//"use strict";
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FileLocator } = require("@mcma/aws-s3");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-09-copy-proxy-to-website-storage", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;


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
            event.progress = 72;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get transform job id
        let transformJobId = getTransformJobId(event);
        // in case we did note do a transcode
        let outputFile;
        let copySource;
        if (!transformJobId) {
            let bme = await resourceManager.get(event.data.bmEssence);
            // copy proxy to website storage
            outputFile = bme.locations[0];
            copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);

        } else {
            let transformJob = await resourceManager.get(transformJobId);

            // copy proxy to website storage
            outputFile = transformJob.jobOutput.outputFile;
            copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);
        }

        let s3Bucket = WebsiteBucket;
        let s3Key = "media/" + uuidv4();
//    let s3Key = "media/proxycopy_" + uuidv4();

        // addin file extension
        let idxLastDot = outputFile.awsS3Key.lastIndexOf(".");
        if (idxLastDot > 0) {
            s3Key += outputFile.awsS3Key.substring(idxLastDot);
        }

        // execute copy proxy
        try {
            let params = {
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            };
            await S3.copyObject(params).promise();
        } catch (error) {
            throw new Exception("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        // copy to temp bucket
        let s3Bucket_copy = TempBucket;
        let s3Key_copy = "temp/proxy";
        s3Key_copy += outputFile.awsS3Key.substring(idxLastDot);
        try {
            let params_copy = {
                CopySource: copySource,
                Bucket: s3Bucket_copy,
                Key: s3Key_copy,
            };
            await S3.copyObject(params_copy).promise();
        } catch (error) {
            throw new Exception("Unable to read input file in bucket '" + s3Bucket_copy + "' with key '" + s3Key_copy + "' due to error: " + error.message);
        }

        // acquire the registered BMContent
//    let bmc = await resourceManager.resolve(event.data.bmContent);

        // create BMEssence
//    let locator = new Locator({
//        "awsS3Bucket": s3Bucket,
//        "awsS3Key": s3Key
//    });

//    let bme = createBMEssence(bmc, locator, "proxy-copy", "proxy-copy");

        // register BMEssence
//    bme = await resourceManager.create(bme);
//    if (!bme.id) {
//        throw new Exception("Failed to register BMEssence.");
//    }

        // addin BMEssence ID
//    bmc.bmEssences.push(bme.id);

        // update BMContents
//    bmc = await resourceManager.update(bmc);

        // construct public https endpoint
        let data = await S3.getBucketLocation({ Bucket: s3Bucket }).promise();
        logger.info(JSON.stringify(data, null, 2));
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
        let httpEndpoint = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;

        // addin ResultPath of StepFunctions
        return new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: s3Key,
            httpEndpoint: httpEndpoint
        });
    } catch (error) {
        logger.error("Failed to copy proxy to website storage");
        logger.error(error.toString());
        throw new Exception("Failed to copy proxy to website storage", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
