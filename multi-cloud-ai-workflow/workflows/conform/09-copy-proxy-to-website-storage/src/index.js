//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3()
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const WEBSITE_BUCKET = process.env.WEBSITE_BUCKET;

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
});

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const resourceManager = new MCMA_CORE.ResourceManager({
    servicesUrl: process.env.SERVICES_URL,
    servicesAuthType: process.env.SERVICES_AUTH_TYPE,
    servicesAuthContext: process.env.SERVICES_AUTH_CONTEXT,
    authProvider
});

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
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 72;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get transform job id
    let transformJobId = getTransformJobId(event);
    // in case we did note do a transcode
    let outputFile;
    let copySource;
    if (!transformJobId) {
        let bme = await resourceManager.resolve(event.data.bmEssence);
        // copy proxy to website storage
        outputFile = bme.locations[0];
        copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);

    } else {
        let transformJob = await resourceManager.resolve(transformJobId);

        // copy proxy to website storage
        outputFile = transformJob.jobOutput.outputFile;
        copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);
    }

    let s3Bucket = WEBSITE_BUCKET;
    let s3Key = "media/" + uuidv4();

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
        await S3CopyObject(params);
    } catch (error) {
        throw new Error("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    // construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    console.log(JSON.stringify(data, null, 2));
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
    let httpEndpoint = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;

    // addin ResultPath of StepFunctions
    return new MCMA_CORE.Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key,
        "httpEndpoint": httpEndpoint
    });
}