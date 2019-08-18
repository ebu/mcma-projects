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
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const ActivityArn = process.env.ActivityArn;

const JOB_PROFILE_NAME = "AWSSsmlTextToSpeech"; 
const JOB_RESULTS_PREFIX = "AIResults/ssmlTextToSpeech/";

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
        event.parallelProgress = { "ssml-text-to-speech": 60 };
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

    // writing speech transcription to a textfile in temp bucket from translation associated to bmContent
    let bmContent = await resourceManager.resolve(event.input.bmContent);


    // see ssml translation to speech step 15
    if (!bmContent.awsAiMetadata ||
        !bmContent.awsAiMetadata.transcription ||
        !bmContent.awsAiMetadata.transcription.ssmlTranslation ) {
        throw new Error("Missing ssml translation on BMContent")
    }

    console.log(bmContent.awsAiMetadata.transcription.ssmlTranslation);

    let s3Bucket = TempBucket;
    let s3Key = "AiInput/ssmlTranslation.txt";

    // extract translation from bmContent and load in a file in tempBucket
    let s3Params = {
        Bucket: s3Bucket,
        Key: s3Key,
//        Key: "AiInput/translation" + uuidv4() + ".txt",
        Body: bmContent.awsAiMetadata.transcription.ssmlTranslation
    }
//   console.log(bmContent.awsAiMetadata.transcription.tokenizedTranslation);

    await S3PutObject(s3Params);


    let s3Object;
        try {
            s3Object = await S3GetObject({
                Bucket: s3Bucket,
                Key: s3Key,
            });
        } catch (error) {
            throw new Error("Unable to copy ssml file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }


    console.log(s3Object.Body.toString());

    let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
    console.log("NotificationUrl:", notificationUrl);

    // creating job
    let job = new AIJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile: new Locator({
                awsS3Bucket: s3Bucket,
                awsS3Key: s3Key
            }),
            voiceId: "Lea",
//            voiceId: "Mizuki",
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
