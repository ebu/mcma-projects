//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const MCMA_CORE = require("mcma-core");

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
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.translateJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TranslationJobId");
    }
    console.log("[TranslationJobId]:", jobId);

    let job = await resourceManager.resolve(jobId);

    // get media info
    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    let translationResult = s3Object.Body.toString();
    console.log("Translation result", translationResult);

    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    if (!bmContent.awsAiMetadata.transcription) {
        bmContent.awsAiMetadata.transcription = {}
    }
    bmContent.awsAiMetadata.transcription.translation = translationResult;

    await resourceManager.update(bmContent);

    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }
}
