//"use strict";

// require
const util = require("util");


const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const { EnvironmentVariableProvider, AIJob, JobParameterBag, Locator, NotificationEndpoint, JobProfile } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "ValidateSpeechToText";
const JOB_RESULTS_PREFIX = "AIResults/";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

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
        event.parallelProgress = { "speech-text-translate": 20 };
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

    //GET stt_output_clean from temp bucket under directory ./stt defined offline 
    //(simulating external editing/correction of the STT from AWS) after stt 
    //-> validation stt input 1 - reference
    let s3Bucket_stt_output_clean = TempBucket;
    let s3Key_stt_output_clean = "temp/stt_output_clean.txt";
    let s3Object_stt_output_clean;
    try {
        s3Object_stt_output_clean = await S3GetObject({
            Bucket: s3Bucket_stt_output_clean,
            Key: s3Key_stt_output_clean,
        });
    } catch (error) {
        throw new Error("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key_stt_output_clean + "' due to error: " + error.message);
    }

    // GET stt output from temp bucket under directory ./stt
    //-> validation stt input 1 -> hypothesis
    let s3Bucket_stt_output = TempBucket;
    let s3Key_stt_output = "temp/stt_output.txt";
    let s3Object_stt_output;
    try {
        s3Object_stt_output = await S3GetObject({
            Bucket: s3Bucket_stt_output,
            Key: s3Key_stt_output,
        });
    } catch (error) {
        throw new Error("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key_stt_output + "' due to error: " + error.message);
    }



    // using input from activity task to ensure we don't have race conditions if two workflows executing simultanously.
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

    // creating job
 /*   let job = new AIJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: s3Object_stt_output,
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
*/
}
