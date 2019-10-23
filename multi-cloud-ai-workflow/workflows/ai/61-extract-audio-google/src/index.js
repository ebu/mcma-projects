//"use strict"

// require
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const { EnvironmentVariableProvider, AIJob, JobParameterBag, Locator, NotificationEndpoint, JobProfile } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const ActivityArn = process.env.ActivityArn;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const RepositoryBucket = process.env.RepositoryBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;

// Local Define
// see definition of name according to profileName defined in deployment/services/src/index.js
const JOB_PROFILE_NAME = "ExtractAudio";
const JOB_RESULTS_PREFIX = "ExtractAudioJobResults/";


/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {

    console.log("###############################");
    console.log("61-extract-audio-google - START");
    console.log("###############################");

    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        // event.progress = 54;
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
    console.log("event:", event);

    // get job profiles filtered by name
    let jobProfiles = await resourceManager.get(JobProfile, { name: JOB_PROFILE_NAME });
    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;
    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("notificationUrl:", notificationUrl);

    // creating the dubbbing srt job giving the original mp4 file as input. To be associated with SRT subtitles and dubbing audio track in service
    let job = new AIJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: event.data.mediaFileLocator,
            outputLocation: new Locator({
                awsS3Bucket: WebsiteBucket,
                awsS3KeyPrefix: JOB_RESULTS_PREFIX
            })
        }),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: notificationUrl
        })
    });

    // posting the transformjob to the job repository
    await resourceManager.create(job);

    console.log("###############################");
    console.log("61-extract-audio-google - END  ");
    console.log("###############################");

};
