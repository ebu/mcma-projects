//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsStartExection = util.promisify(StepFunctions.startExecution.bind(StepFunctions));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const JOB_PROFILE_CONFORM_WORKFLOW = "ConformWorkflow";
const JOB_PROFILE_AI_WORKFLOW = "AiWorkflow";

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    switch (event.action) {
        case "ProcessJobAssignment":
            await processJobAssignment(event);
            break;
        case "ProcessNotification":
            await processNotification(event);
            break;
    }
}

const processJobAssignment = async (event) => {
    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving WorkflowJob
        let workflowJob = await retrieveWorkflowJob(table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(workflowJob);

        // 4. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(workflowJob);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        validateJobProfile(jobProfile, jobInput);

        // 6. Launch the appropriate workflow
        const workflowInput = {
            "input": jobInput,
            "notificationEndpoint": new MCMA_CORE.NotificationEndpoint(jobAssignmentId + "/notifications")
        };

        const params = {
            input: JSON.stringify(workflowInput)
        };

        switch (jobProfile.name) {
            case JOB_PROFILE_CONFORM_WORKFLOW:
                params.stateMachineArn = event.request.stageVariables.ConformWorkflowId;
                break;
            case JOB_PROFILE_AI_WORKFLOW:
                params.stateMachineArn = event.request.stageVariables.AiWorkflowId;
                break;
        }

        let data = await StepFunctionsStartExection(params);

        // 7. saving the executionArn on the jobAssignment
        let jobAssignment = await getJobAssignment(table, jobAssignmentId);
        jobAssignment.workflowExecutionId = data.executionArn;
        await putJobAssignment(resourceManager, table, jobAssignmentId, jobAssignment);
    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }
}

const processNotification = async (event) => {
    let jobAssignmentId = event.jobAssignmentId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);

    jobAssignment.status = notification.content.status;
    jobAssignment.statusMessage = notification.content.statusMessage;
    if (notification.content.progress !== undefined) {
        jobAssignment.progress = notification.content.progress;
    }
    jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date().toISOString();

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    await resourceManager.sendNotification(jobAssignment);
}

const validateJobProfile = (jobProfile, jobInput) => {
    if (jobProfile.name !== JOB_PROFILE_CONFORM_WORKFLOW &&
        jobProfile.name !== JOB_PROFILE_AI_WORKFLOW) {
        throw new Error("JobProfile '" + jobProfile.name + "' is not supported");
    }

    if (jobProfile.inputParameters) {
        if (!Array.isArray(jobProfile.inputParameters)) {
            throw new Error("JobProfile.inputParameters is not an array");
        }

        for (parameter of jobProfile.inputParameters) {
            if (jobInput[parameter.parameterName] === undefined) {
                throw new Error("jobInput misses required input parameter '" + parameter.parameterName + "'");
            }
        }
    }
}

const retrieveJobInput = async (job) => {
    return await retrieveResource(job.jobInput, "job.jobInput");
}

const retrieveJobProfile = async (job) => {
    return await retrieveResource(job.jobProfile, "job.jobProfile");
}

const retrieveWorkflowJob = async (table, jobAssignmentId) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);

    return await retrieveResource(jobAssignment.job, "jobAssignment.job");
}

const retrieveResource = async (resource, resourceName) => {
    let type = typeof resource;

    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    if (type === "string") {  // if type is a string we assume it's a URL.
        try {
            let response = await MCMA_CORE.HTTP.get(resource);
            resource = response.data;
        } catch (error) {
            throw new Error("Failed to retrieve '" + resourceName + "' from url '" + resource + "'");
        }
    }

    type = typeof resource;

    if (type === "object") {
        if (Array.isArray(resource)) {
            throw new Error(resourceName + " has illegal type 'Array'");
        }

        return resource;
    } else {
        throw new Error(resourceName + " has illegal type '" + type + "'");
    }
}

const updateJobAssignmentWithOutput = async (table, jobAssignmentId, jobOutput) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.jobOutput = jobOutput;
    await putJobAssignment(null, table, jobAssignmentId, jobAssignment);
}

const updateJobAssignmentStatus = async (resourceManager, table, jobAssignmentId, status, statusMessage) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.status = status;
    jobAssignment.statusMessage = statusMessage;
    await putJobAssignment(resourceManager, table, jobAssignmentId, jobAssignment);
}

const getJobAssignment = async (table, jobAssignmentId) => {
    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        throw new Error("JobAssignment with id '" + jobAssignmentId + "' not found");
    }
    return jobAssignment;
}

const putJobAssignment = async (resourceManager, table, jobAssignmentId, jobAssignment) => {
    jobAssignment.dateModified = new Date().toISOString();
    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    if (resourceManager) {
        await resourceManager.sendNotification(jobAssignment);
    }
}
