//"use strict"

// require
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const ACTIVITY_ARN = process.env.ACTIVITY_ARN;
const ACTIVITY_CALLBACK_URL = process.env.ACTIVITY_CALLBACK_URL;
const TEMP_BUCKET = process.env.TEMP_BUCKET;
const REPOSITORY_BUCKET = process.env.REPOSITORY_BUCKET;
const WEBSITE_BUCKET = process.env.WEBSITE_BUCKET;

// Local Define
const RESOURCE_TYPE_JOB_PROFILE = "JobProfile";
const JOB_PROFILE_NAME = "CreateProxyLambda";

const creds = {
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
	sessionToken: AWS.config.credentials.sessionToken,
	region: AWS.config.region
};

const presignedUrlGenerator = new MCMA_CORE.AwsV4PresignedUrlGenerator(creds);
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

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 54;
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
    let jobProfiles = await resourceManager.get(RESOURCE_TYPE_JOB_PROFILE, { name: JOB_PROFILE_NAME });

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    // creating the tranformjob(lambda)
    let createProxyJob = new MCMA_CORE.TransformJob({
        jobProfile: jobProfileId,
        jobInput: new MCMA_CORE.JobParameterBag({
            inputFile: event.data.repositoryFile,
            outputLocation: new MCMA_CORE.Locator({
                awsS3Bucket: REPOSITORY_BUCKET,
                awsS3KeyPrefix: "TransformJobResults/"
            })
        }),
        notificationEndpoint: new MCMA_CORE.NotificationEndpoint({
            httpEndpoint: presignedUrlGenerator.generatePresignedUrl("POST", ACTIVITY_CALLBACK_URL + "?taskToken=" + encodeURIComponent(taskToken), 7200)
        })
    });

    // posting the transformjob to the job repository
    createProxyJob = await resourceManager.create(createProxyJob);
}
