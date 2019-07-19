//"use strict";

// require
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const { EnvironmentVariableProvider, AmeJob, JobParameterBag, Locator, NotificationEndpoint, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));

// Environment Variable(AWS Lambda)

const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
    console.log(TempBucket, ActivityCallbackUrl, ActivityArn);

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 27;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get activity task
    let data = await StepFunctionsGetActivityTask({ activityArn: ActivityArn });

    let taskToken = data.taskToken;
    if (!taskToken) {
        throw new Error("Failed to obtain activity task")
    }

    // using input from activity task to ensure we don't have race conditions if two workflows execute simultanously.
    event = JSON.parse(data.input);

    // get job profiles filtered by name
    let jobProfiles = await resourceManager.get(JobProfile, { name: "ExtractTechnicalMetadata" });

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile 'ExtractTechnicalMetadata' not found");
    }

    let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("NotificationUrl:", notificationUrl);

    // creating ame job
    let ameJob = new AmeJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: event.data.repositoryFile,
            outputLocation: new Locator({
                awsS3Bucket: TempBucket,
                awsS3KeyPrefix: "AmeJobResults/"
            })
        }),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: notificationUrl
        })
    });

    console.log("Sending AmeJob:", JSON.stringify(ameJob, null, 2));

    // posting the amejob to the job repository
    ameJob = await resourceManager.create(ameJob);
}