//"use strict";
const AWS = require("aws-sdk");

const { Exception, EnvironmentVariableProvider, WorkflowJob, JobParameterBag, JobProfile } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-11-start-ai-workflow", process.env.LogGroupName);

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    const logger = loggerProvider.get(event.tracker);
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
            throw new Exception("JobProfile 'AiWorkflow' not found");
        }

        // creating workflow job
        let workflowJob = new WorkflowJob({
            jobProfile: jobProfileId,
            jobInput: new JobParameterBag({
                bmContent: event.data.bmContent,
                bmEssence: event.data.bmEssence
            })
        });

        // posting the workflowJob to the job repository
        // workflowJob = await resourceManager.create(workflowJob);

        // returning workflow output
        return {
            // aiWorkflow: workflowJob.id,
            bmContent: event.data.bmContent,
            websiteMediaFile: event.data.websiteFile
        };
    } catch (error) {
        logger.error("Failed to start AI workflow");
        logger.error(error.toString());
        throw new Exception("Failed to start AI workflow", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
