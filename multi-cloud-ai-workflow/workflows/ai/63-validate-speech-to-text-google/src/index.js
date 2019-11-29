//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const { EnvironmentVariableProvider, AIJob, JobParameterBag, Locator, NotificationEndpoint, JobProfile } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "ValidateSpeechToTextGoogle";
const JOB_RESULTS_PREFIX = "AIResults/";

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
        // event.parallelProgress = { "speech-text-translate": 60 };
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

    console.log("jobProfiles:", jobProfiles);

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    console.log("jobProfileId:", jobProfileId);

    // manage notification
    let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("notificationUrl:", notificationUrl);

    // writing speech transcription to a textfile in temp bucket
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    console.log("bmContent:", bmContent);

    // writing CLEAN speech transcription to a textfile in temp bucket and provide via bmContent
    // Other option, SEE ALSO Bucket: TempBucket, Key: "stt/stt_output_clean" + ".txt", from step 3

    if (!bmContent.googleAiMetadata ||
        !bmContent.googleAiMetadata.transcription) {
        throw new Error("Missing transcription on BMContent")
    }

    console.log("bmContent.googleAiMetadata:", bmContent.googleAiMetadata);
    console.log("bmContent.googleAiMetadata.transcription:", bmContent.googleAiMetadata.transcription);

    let s3Params = {
        Bucket: TempBucket,
        Key: "temp/stt_output_google.txt",
        Body: bmContent.googleAiMetadata.transcription
    };

    await S3PutObject(s3Params);

    // creating stt benchmarking job
    let job = new AIJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: new Locator({
                awsS3Bucket: s3Params.Bucket,
                awsS3Key: s3Params.Key
            }),
            outputLocation: new Locator({
                awsS3Bucket: TempBucket,
                awsS3KeyPrefix: JOB_RESULTS_PREFIX
            })
        }),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: notificationUrl
        })
    });

    // posting the job to the job repository
    job = await resourceManager.create(job);
};
