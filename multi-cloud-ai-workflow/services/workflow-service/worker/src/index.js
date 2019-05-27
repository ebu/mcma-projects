//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsStartExection = util.promisify(StepFunctions.startExecution.bind(StepFunctions));

const MCMA_AWS = require("mcma-aws");
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

const createResourceManager = (event) => {
    return new MCMA_CORE.ResourceManager({
        servicesUrl: event.stageVariables.ServicesUrl,
        servicesAuthType: event.stageVariables.ServicesAuthType,
        servicesAuthContext: event.stageVariables.ServicesAuthContext,
        authProvider
    });
}

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        switch (event.action) {
            case "ProcessJobAssignment":
                await processJobAssignment(event);
                break;
            case "ProcessNotification":
                await processNotification(event);
                break;
            case "CreateJobProfile":
                await createJobProfile(event);
                break;
            case "DeleteJobProfile":
                await deleteJobProfile(event);
                break;
            default:
                throw new Error("Not implemented");
        }
    } catch (error) {
        console.log("Error occurred when handling action '" + event.action + "'")
        console.log(error.toString());
    }
}

const processJobAssignment = async (event) => {
    let resourceManager = createResourceManager(event);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving WorkflowJob
        let workflowJob = await retrieveWorkflowJob(resourceManager, table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(resourceManager, workflowJob);

        // 4. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(resourceManager, workflowJob);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        let workflow = await findWorkflowForJobProfile(table, jobProfile, jobInput);

        // 6. Launch the appropriate workflow
        const workflowInput = {
            "input": jobInput,
            "notificationEndpoint": new MCMA_CORE.NotificationEndpoint({
                httpEndpoint: jobAssignmentId + "/notifications"
            })
        };

        const params = {
            stateMachineArn: workflow.stateMachineArn,
            input: JSON.stringify(workflowInput)
        };

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

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);

    jobAssignment.status = notification.content.status;
    jobAssignment.statusMessage = notification.content.statusMessage;
    if (notification.content.progress !== undefined) {
        jobAssignment.progress = notification.content.progress;
    }
    jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date().toISOString();

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    let resourceManager = createResourceManager(event);

    await resourceManager.sendNotification(jobAssignment);
}

const createJobProfile = async (event) => {
    let resourceManager = createResourceManager(event);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let workflowId = event.workflowId;

    let workflow = await table.get("Workflow", workflowId);
    if (!workflow) {
        throw new Error("Workflow with id '" + workflowId + "' not found");
    }

    let jobProfile;

    switch (workflow["@type"]) {
        case "AWSStepFunctionsWorkflow":
            if (!workflow.stateMachineArn) {
                throw new Error("AWSStepFunctionsWorkflow misses property stateMachineArn");
            }

            jobProfile = new MCMA_CORE.JobProfile({
                name: workflow.name,
                inputParameters: workflow.inputParameters,
                outputParameters: workflow.outputParameters,
                optionalInputParameters: workflow.optionalInputParameters
            });
            break;
        default:
            throw new Error("Unsupported workflow type '" + workflow["@type"] + "'");
    }

    jobProfile = await resourceManager.create(jobProfile);

    workflow.jobProfile = jobProfile.id;
    await table.put("Workflow", workflowId, workflow);

    await updateServiceInRegistry(event, resourceManager);
}

const deleteJobProfile = async (event) => {
    let resourceManager = createResourceManager(event);
    
    let jobProfileId = event.jobProfileId;

    let jobProfile = await resourceManager.resolve(jobProfileId);
    if (jobProfile) {
        await resourceManager.delete(jobProfile);
    }

    await updateServiceInRegistry(event, resourceManager);
}

const updateServiceInRegistry = async (event, resourceManager) => {
    let workflowService;

    let services = await resourceManager.get("Service");
    for (const service of services) {
        for (const resourceEndpoint of service.resources) {
            if (resourceEndpoint.httpEndpoint.startsWith(event.stageVariables.PublicUrl)) {
                workflowService = service;
            }
        }
    }

    if (!workflowService) {
        console.warn("Update Workflow Service in Service Registry failed: Not found");
        return;
    }

    workflowService.jobProfiles = [];
    
    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let workflows = await table.getAll("Workflow");

    for (const workflow of workflows) {
        if (workflow.jobProfile) {
            workflowService.jobProfiles.push(workflow.jobProfile);
        }
    }

    console.log("Updating workflow service in Service Registry", JSON.stringify(workflowService, null, 2));
    await resourceManager.update(workflowService);
}

const findWorkflowForJobProfile = async (table, jobProfile, jobInput) => {
    let workflows = await table.getAll("Workflow");

    let workflow;
    for (wf of workflows) {
        if (wf.jobProfile === jobProfile.id) {
            workflow = wf;
        }
    }

    if (!workflow) {
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

    return workflow;
}

const retrieveJobInput = async (resourceManager, job) => {
    return await retrieveResource(resourceManager, job.jobInput, "job.jobInput");
}

const retrieveJobProfile = async (resourceManager, job) => {
    return await retrieveResource(resourceManager, job.jobProfile, "job.jobProfile");
}

const retrieveWorkflowJob = async (resourceManager, table, jobAssignmentId) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);

    return await retrieveResource(resourceManager, jobAssignment.job, "jobAssignment.job");
}

const retrieveResource = async (resourceManager, resource, resourceName) => {
    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    resource = await resourceManager.resolve(resource);

    let type = typeof resource;

    if (type === "object") {
        if (Array.isArray(resource)) {
            throw new Error(resourceName + " has illegal type 'Array'");
        }

        return resource;
    } else {
        throw new Error(resourceName + " has illegal type '" + type + "'");
    }
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
