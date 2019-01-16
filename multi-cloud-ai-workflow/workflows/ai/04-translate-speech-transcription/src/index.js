//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const TEMP_BUCKET = process.env.TEMP_BUCKET;
const ACTIVITY_CALLBACK_URL = process.env.ACTIVITY_CALLBACK_URL;
const ACTIVITY_ARN = process.env.ACTIVITY_ARN;

const JOB_PROFILE_NAME = "AWSTranslateText"
const JOB_RESULTS_PREFIX = "AIResults/"

const creds = {
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
};

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator(creds);

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
    console.log(TEMP_BUCKET, ACTIVITY_CALLBACK_URL, ACTIVITY_ARN);

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 60 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get activity task
    let data = await StepFunctionsGetActivityTask({ activityArn: ACTIVITY_ARN });

    let taskToken = data.taskToken;
    if (!taskToken) {
        throw new Error("Failed to obtain activity task")
    }

    // using input from activity task to ensure we don't have race conditions if two workflows execute simultanously.
    event = JSON.parse(data.input);

    // get job profiles filtered by name
    let jobProfiles = await resourceManager.get("JobProfile", { name: JOB_PROFILE_NAME });

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    // writing speech transcription to a textfile in temp bucket
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.awsAiMetadata ||
        !bmContent.awsAiMetadata.transcription ||
        !bmContent.awsAiMetadata.transcription.original) {
        throw new Error("Missing transcription on BMContent")
    }

    let s3Params = {
        Bucket: TEMP_BUCKET,
        Key: "AiInput/" + uuidv4() + ".txt",
        Body: bmContent.awsAiMetadata.transcription.original
    }

    await S3PutObject(s3Params);

    let notificationUrl = ACTIVITY_CALLBACK_URL + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("NotificationUrl:", notificationUrl);

    // creating job
    let job = new MCMA_CORE.AIJob({
        jobProfile: jobProfileId,
        jobInput: new MCMA_CORE.JobParameterBag({
            inputFile: new MCMA_CORE.Locator({
                awsS3Bucket: s3Params.Bucket,
                awsS3Key: s3Params.Key
            }),
            targetLanguageCode: "ja",
            outputLocation: new MCMA_CORE.Locator({
                awsS3Bucket: TEMP_BUCKET,
                awsS3KeyPrefix: JOB_RESULTS_PREFIX
            })
        }),
        notificationEndpoint: new MCMA_CORE.NotificationEndpoint({
            httpEndpoint: notificationUrl
        })
    });

    // posting the job to the job repository
    job = await resourceManager.create(job);
}
