//"use strict";

// require
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsGetActivityTask = util.promisify(StepFunctions.getActivityTask.bind(StepFunctions));

const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const { EnvironmentVariableProvider, AIJob, JobParameterBag, Locator, NotificationEndpoint, JobProfile } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const TempBucket = process.env.TempBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

//const JOB_PROFILE_NAME = "AWSTextToSpeech";
const JOB_PROFILE_NAME = "AWSTokenizedTextToSpeech";
const JOB_RESULTS_PREFIX = "AIResults/ssml/";


// Calling text-to-speech Polly service to analyse translation text per sentence and generate SSML file for speech to text
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
        event.parallelProgress = { "tokenized-text-to-speech": 60 };
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

    console.log("[tokenized:]",jobProfileId)

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile '" + JOB_PROFILE_NAME + "' not found");
    }

    // writing speech transcription to a textfile in temp bucket from translation associated to bmContent
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.awsAiMetadata ||
        !bmContent.awsAiMetadata.transcription ||
        !bmContent.awsAiMetadata.transcription.translation ) {
        throw new Error("Missing translation on BMContent")
    }
    // extract translation from bmContent and load in a file in tempBucket
    let s3Params = {
        Bucket: TempBucket,
        Key: "AiInput/translation.txt",
//        Key: "AiInput/tokenizedTranslation.txt",
        Body: bmContent.awsAiMetadata.transcription.translation
    }
    await S3PutObject(s3Params);
    console.log(bmContent.awsAiMetadata.transcription.translation);


    // extract preloaded and edited srt_translation_output.srt websiteBucket/assets/srt and transfer in a file in tempBucket/srt
    let s3Object_assets_srt;
    try {
        s3Object_assets_srt = await S3GetObject({
            Bucket: WebsiteBucket,
            Key: "assets/srt/srt_translation_output.srt",
        });
    } catch (error) {
        throw new Error("Unable to copy translation srt file from bucket '" + WebsiteBucket + "' with key '" + "assets/srt/srt_translation_output.srt" + "' due to error: " + error.message);
    }
    let s3Params_translation_srt = {
        Bucket: TempBucket,
        Key: "srt/srt_translation_output.srt",
        Body: s3Object_assets_srt.Body
    }
    await S3PutObject(s3Params_translation_srt);



    let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("NotificationUrl:", notificationUrl);

    // creating job using file with (tokenized) translation text stored in temp bucket
    let job = new AIJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: new Locator({
                awsS3Bucket: s3Params.Bucket,
                awsS3Key: s3Params.Key
            }),
            voiceId: "Mizuki",
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
}
