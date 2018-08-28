//"use strict";

// require
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 90;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // get job profiles filtered by name
    let jobProfiles = await resourceManager.get("JobProfile", { name : "AiWorkflow"});

    let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

    // if not found bail out
    if (!jobProfileId) {
        throw new Error("JobProfile 'AiWorkflow' not found");
    }

    // creating workflow job
    let workflowJob = new MCMA_CORE.WorkflowJob(
        jobProfileId,
        new MCMA_CORE.JobParameterBag({
            bmContent: event.data.bmContent,
            bmEssence: event.data.bmEssence
        })
    );

    // posting the workflowJob to the job repository
    workflowJob = await resourceManager.create(workflowJob);

    // returning workflow output
    return {
        aiWorkflow: workflowJob.id,
        websiteMediaFile: event.data.websiteFile
    }
}
