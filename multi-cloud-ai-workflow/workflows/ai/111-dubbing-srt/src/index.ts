import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AIJob, EnvironmentVariableProvider, JobParameterBag, JobProfile, McmaException, McmaTracker, NotificationEndpoint } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

const StepFunctions = new AWS.StepFunctions();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-111-dubbing-srt", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const ActivityArn = process.env.ActivityArn;
const ActivityCallbackUrl = process.env.ActivityCallbackUrl;
const RepositoryBucket = process.env.RepositoryBucket;
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;

// Local Define
const JOB_PROFILE_NAME = "CreateDubbingSrt";
const JOB_RESULTS_PREFIX = "DubbingSrtJobResults/";

type InputEvent = {
    tracker?: McmaTracker
}

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);
        logger.info(TempBucket, ActivityCallbackUrl, ActivityArn);

        // get activity task
        let data = await StepFunctions.getActivityTask({ activityArn: ActivityArn }).promise();

        let taskToken = data.taskToken;
        if (!taskToken) {
            throw new McmaException("Failed to obtain activity task");
        }

        // using input from activity task to ensure we don't have race conditions if two workflows execute simultaneously.
        event = JSON.parse(data.input);
        logger.info(event);

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: JOB_PROFILE_NAME });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile '" + JOB_PROFILE_NAME + "' not found");
        }

        let notificationUrl = ActivityCallbackUrl + "?taskToken=" + encodeURIComponent(taskToken);
        logger.info("NotificationUrl:", notificationUrl);

        // creating the dubbing srt job giving the original mp4 file as input. To be associated with SRT subtitles and dubbing audio track in service
        let job = new AIJob({
            jobProfileId: jobProfileId,
            jobInput: new JobParameterBag({
                inputFile: new AwsS3FileLocator({
                    bucket: TempBucket,
                    key: "temp/proxy.mp4"
                }),
                outputLocation: new AwsS3FolderLocator({
                    bucket: WebsiteBucket,
                    keyPrefix: JOB_RESULTS_PREFIX
                })
            }),
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: notificationUrl
            }),
            tracker: event.tracker,
        });

        // posting the ai job to the job repository
        job = await resourceManager.create(job);
    } catch (error) {
        logger.error("Failed to do dubbing SRT");
        logger.error(error.toString());
        throw new McmaException("Failed to do dubbing SRT", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
