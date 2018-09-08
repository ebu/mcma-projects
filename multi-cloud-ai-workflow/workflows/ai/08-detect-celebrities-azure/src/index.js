//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const TEMP_BUCKET = process.env.TEMP_BUCKET;
const ACTIVITY_CALLBACK_URL = process.env.ACTIVITY_CALLBACK_URL;
const ACTIVITY_ARN = process.env.ACTIVITY_ARN;

const JOB_PROFILE_NAME = "AzureExtractAllAIMetadata"
const JOB_RESULTS_PREFIX = "AIResults/"

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
    console.log(SERVICE_REGISTRY_URL, TEMP_BUCKET, ACTIVITY_CALLBACK_URL, ACTIVITY_ARN);

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "detect-celebrities-azure": 20 };
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

    // creating job
    let job = new MCMA_CORE.AIJob(
        jobProfileId,
        new MCMA_CORE.JobParameterBag({
            inputFile: event.data.mediaFileLocator,
            outputLocation: new MCMA_CORE.Locator({
                awsS3Bucket: TEMP_BUCKET,
                awsS3KeyPrefix: JOB_RESULTS_PREFIX
            })
        }),
        new MCMA_CORE.NotificationEndpoint(ACTIVITY_CALLBACK_URL + "?taskToken=" + encodeURIComponent(taskToken)));

    // posting the job to the job repository
    job = await resourceManager.create(job);
}
