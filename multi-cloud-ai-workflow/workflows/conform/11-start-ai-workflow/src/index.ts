import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, JobParameterBag, JobProfile, McmaException, McmaTracker, NotificationEndpointProperties, WorkflowJob } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator } from "@mcma/aws-s3";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-11-start-ai-workflow", process.env.LogGroupName);

type InputEvent = {
    data: {
        bmContent: string
        bmEssence: string
        websiteFile: AwsS3FileLocator
    }
    progress?: number
    tracker?: McmaTracker
    notificationEndpoint?: NotificationEndpointProperties
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

        // send update notification
        try {
            event.progress = 90;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get job profiles filtered by name
        let jobProfiles = await resourceManager.query(JobProfile, { name: "AiWorkflow" });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new McmaException("JobProfile 'AiWorkflow' not found");
        }

        // creating workflow job
        let workflowJob = new WorkflowJob({
            jobProfileId: jobProfileId,
            jobInput: new JobParameterBag({
                bmContent: event.data.bmContent,
                bmEssence: event.data.bmEssence
            }),
            tracker: event.tracker
        });

        // posting the workflowJob to the job repository
        workflowJob = await resourceManager.create(workflowJob);

        // returning workflow output
        return {
            aiWorkflow: workflowJob.id,
            bmContent: event.data.bmContent,
            websiteMediaFile: event.data.websiteFile
        };
    } catch (error) {
        logger.error("Failed to start AI workflow");
        logger.error(error.toString());
        throw new McmaException("Failed to start AI workflow", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
