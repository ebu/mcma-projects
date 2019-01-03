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
        event.parallelProgress = { "detect-celebrities-aws": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.awsCelebritiesJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain awsCelebritiesJobId");
    }
    console.log("[awsCelebritiesJobId]:", jobId);

    let job = await resourceManager.resolve(jobId);

    // get celebrities info 
    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to celebrities info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    let celebritiesResult = JSON.parse(s3Object.Body.toString());

    let celebritiesMap = { };

    for (let i = 0; i < celebritiesResult.Celebrities.length;) {
        let celebrity = celebritiesResult.Celebrities[i];

        let prevCelebrity = celebritiesMap[celebrity.Celebrity.Name];
        if ((!prevCelebrity || celebrity.Timestamp - prevCelebrity.Timestamp > 3000) && celebrity.Celebrity.Confidence > 50) {
            celebritiesMap[celebrity.Celebrity.Name] = celebrity;
            i++;
        } else {
            celebritiesResult.Celebrities.splice(i, 1);
        }
    }

    console.log("AWS Celebrities result", JSON.stringify(celebritiesResult, null, 2));

    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    bmContent.awsAiMetadata.celebrities = celebritiesResult;

    await resourceManager.update(bmContent);

    try {
        event.status = "RUNNING";
        event.parallelProgress = { "detect-celebrities-aws": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }
}
