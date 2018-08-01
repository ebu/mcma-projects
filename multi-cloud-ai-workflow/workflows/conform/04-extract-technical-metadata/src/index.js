//"use strict";

const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));


const MCMA_CORE = require("mcma-core");

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const TEMP_BUCKET = process.env.TEMP_BUCKET;
const ACTIVITY_CALLBACK_URL = process.env.ACTIVITY_CALLBACK_URL;
const ACTIVITY_ARN = process.env.ACTIVITY_ARN;

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
    console.log(SERVICE_REGISTRY_URL, TEMP_BUCKET, ACTIVITY_CALLBACK_URL, ACTIVITY_ARN);

    // get activity task
    let data = await StepFunctionsGetActivityTask({ activityArn: ACTIVITY_ARN});

    console.log(data)

    let taskToken = data.taskToken;
    if (!taskToken) {
        throw new Error("Failed to obtain activity task")
    }

    // using input from activity task to ensure we don't have race conditions if two workflows execute simultanously.
    event = JSON.parse(data.input);

    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // get all job profiles
    let jobProfiles = await resourceManager.get("JobProfile");

    let jobProfileId;

    // find job profile with correct name
    for (const jobProfile of jobProfiles) {
        if (jobProfile.name === "ExtractTechnicalMetadata") {
            jobProfileId = jobProfile.id;
            break;
        }
    }

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile 'ExtractTechnicalMetadata' not found");
    }

    // creating ame job
    let ameJob = new MCMA_CORE.AmeJob(
        jobProfileId,
        new MCMA_CORE.JobParameterBag({
            inputFile: event.data.repositoryFile,
            outputLocation: new MCMA_CORE.Locator({
                awsS3Bucket: TEMP_BUCKET,
                awsS3KeyPrefix: "AmeJobResults/"
            })
        }),
        new MCMA_CORE.NotificationEndpoint(ACTIVITY_CALLBACK_URL + "?taskToken=" + encodeURIComponent(taskToken)));

    // posting the amejob to the job repository
    ameJob = await resourceManager.create(ameJob);
}