//"use strict";

// require
const AWS = require("aws-sdk");
const MCMA_CORE = require("mcma-core");

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
});

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const resourceManager = new MCMA_CORE.ResourceManager({
    servicesUrl: process.env.SERVICES_URL,
    servicesAuthType: process.env.SERVICES_AUTH_TYPE,
    servicesAuthContext: process.env.SERVICES_AUTH_CONTEXT,
    authProvider
});

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
    let workflowJob = new MCMA_CORE.WorkflowJob({
        jobProfile: jobProfileId,
        jobInput: new MCMA_CORE.JobParameterBag({
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
