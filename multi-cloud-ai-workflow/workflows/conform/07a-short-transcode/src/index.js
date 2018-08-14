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
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const TEMP_BUCKET = process.env.TEMP_BUCKET;

// Local Define
const RESORCE_TYPE_JOB_PROFILE = "JobProfile";
const JOB_PROFILE_NAME = "CreateProxyLambda";

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // get activity task
    let data = await StepFunctionsGetActivityTask({ activityArn: ACTIVITY_ARN });

    let taskToken = data.taskToken;
    if (!taskToken) {
        throw new Error("Failed to obtain activity task")
    }

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 54;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

	// get all job profiles
    let jobProfiles = await resourceManager.get(RESORCE_TYPE_JOB_PROFILE);

    // find job profile with correct name
    let jobProfileId;

    for (const jobProfile of jobProfiles) {
        if (jobProfile.name === JOB_PROFILE_NAME) {
            jobProfileId = jobProfile.id;
            break;
        }
    }

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    // creating the tranformjob(lambda)
    let createProxyJob = new MCMA_CORE.TransformJob(
        jobProfileId,
        new MCMA_CORE.JobParameterBag({
            inputFile: event.data.repositoryFile,
            outputLocation: new MCMA_CORE.Locator({
                awsS3Bucket: TEMP_BUCKET,
                awsS3KeyPrefix: "TransformJobResults/"
            })
        }),
        new MCMA_CORE.NotificationEndpoint(ACTIVITY_CALLBACK_URL + "?taskToken=" + encodeURIComponent(taskToken))
    );

    // posting the transformjob to the job repository
    createProxyJob = await resourceManager.create(createProxyJob);
}
