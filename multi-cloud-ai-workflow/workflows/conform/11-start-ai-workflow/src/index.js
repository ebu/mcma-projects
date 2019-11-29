//"use strict";

const { EnvironmentVariableProvider, WorkflowJob, JobParameterBag, JobProfile } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

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
        event.progress = 90;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get job profiles filtered by name
    let jobProfiles = await resourceManager.get(JobProfile, { name : "AiWorkflow"});

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile 'AiWorkflow' not found");
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
    workflowJob = await resourceManager.create(workflowJob);

    // returning workflow output
    return {
        aiWorkflow: workflowJob.id,
        bmContent: event.data.bmContent,
        websiteMediaFile: event.data.websiteFile
    }
}
