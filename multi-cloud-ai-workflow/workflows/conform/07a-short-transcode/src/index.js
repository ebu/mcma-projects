//"use strict"

// require
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const { EnvironmentVariableProvider, TransformJob, Locator, NotificationEndpoint, JobProfile } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const ActivityArn = process.env.ActivityArn;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const RepositoryBucket = process.env.RepositoryBucket;

// Local Define
const JOB_PROFILE_NAME = "CreateProxyLambda";


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
    let jobProfiles = await resourceManager.get(JobProfile, { name: JOB_PROFILE_NAME });

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("NotificationUrl:", notificationUrl);


    // creating the tranformjob(lambda)
    let createProxyJob = new TransformJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: event.data.repositoryFile,
            outputLocation: new Locator({
                awsS3Bucket: RepositoryBucket,
                awsS3KeyPrefix: "TransformJobResults/"
            })
        }),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: notificationUrl
        })
    });

    // posting the transformjob to the job repository
    createProxyJob = await resourceManager.create(createProxyJob);
}
