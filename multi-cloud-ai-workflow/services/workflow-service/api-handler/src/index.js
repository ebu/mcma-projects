//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.
const getJobAssignments = async (request, response) => {
    console.log("getJobAssignments()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("JobAssignment");

    console.log(JSON.stringify(response, null, 2));
}

const deleteJobAssignments = async (request, response) => {
    console.log("deleteJobAssignments()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignments = await table.getAll("JobAssignment");

    for (let i = 0; i < jobAssignments.length; i++) {
        await table.delete("JobAssignment", jobAssignments[i].id);
    }

    console.log(JSON.stringify(response, null, 2));
}

const addJobAssignment = async (request, response) => {
    console.log("addJobAssignment()", JSON.stringify(request, null, 2));

    let jobAssignment = request.body;
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobAssignmentId = request.stageVariables.PublicUrl + "/job-assignments/" + uuidv4();
    if (jobAssignment["@type"] !== "JobAssignment") {
        jobAssignment["@type"] = "JobAssignment";
    }
    jobAssignment.id = jobAssignmentId;
    jobAssignment.status = "NEW";
    jobAssignment.dateCreated = new Date().toISOString();
    jobAssignment.dateModified = jobAssignment.dateCreated;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobAssignment.id;
    response.body = jobAssignment;

    console.log(JSON.stringify(response, null, 2));

    // invoking worker lambda function that does the starting of the workflow
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({
            action: "ProcessJobAssignment",
            stageVariables: request.stageVariables,
            jobAssignmentId
        })
    };

    await LambdaInvoke(params);
}

const getJobAssignment = async (request, response) => {
    console.log("getJobAssignment()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("JobAssignment", jobAssignmentId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const deleteJobAssignment = async (request, response) => {
    console.log("deleteJobAssignment()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + request.path;

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("JobAssignment", jobAssignmentId);
}

const getWorkflows = async (request, response) => {
    console.log("getWorkflows()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("Workflow");

    console.log(JSON.stringify(response, null, 2));
}

const addWorkflow = async (request, response) => {
    console.log("addWorkflow()", JSON.stringify(request, null, 2));

    let workflow = request.body;
    if (!workflow) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    if (!workflow["@type"]) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing '@type' property.";
        return;
    }

    let workflowId = request.stageVariables.PublicUrl + "/workflows/" + uuidv4();
    workflow.id = workflowId;
    workflow.dateCreated = new Date().toISOString();
    workflow.dateModified = workflow.dateCreated;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("Workflow", workflowId, workflow);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = workflow.id;
    response.body = workflow;

    console.log(JSON.stringify(response, null, 2));

    // invoking worker lambda function that will create a job profile based on workflow definition and adds it in the service registry.
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({
            action: "CreateJobProfile",
            stageVariables: request.stageVariables,
            workflowId: workflowId
        })
    };

    await LambdaInvoke(params);
}

const getWorkflow = async (request, response) => {
    console.log("getWorkflow()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let workflowId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("Workflow", workflowId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const deleteWorkflow = async (request, response) => {
    console.log("deleteWorkflow()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let workflowId = request.stageVariables.PublicUrl + request.path;

    let workflow = await table.get("Workflow", workflowId);
    if (!workflow) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("Workflow", workflowId);

    // invoking worker lambda function that will delete the JobProcess created for this Job
    if (workflow.jobProfile) {
        var params = {
            FunctionName: request.stageVariables.WorkerLambdaFunctionName,
            InvocationType: "Event",
            LogType: "None",
            Payload: JSON.stringify({
                action: "DeleteJobProfile",
                stageVariables: request.stageVariables,
                jobProfileId: workflow.jobProfile
            })
        };

        await LambdaInvoke(params);
    }
}

const processNotification = async (request, response) => {
    console.log("processNotification()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + "/job-assignments/" + request.pathVariables.id;

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    let notification = request.body;

    if (!notification) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification in request body";
        return;
    }

    // if (jobAssignment.workflowExecutionId !== notification.source) {
    //     response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
    //     response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
    //     return;
    // }

    // invoking worker lambda function that will process the notification
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({
            action: "ProcessNotification",
            stageVariables: request.stageVariables,
            jobAssignmentId,
            notification
        })
    };

    await LambdaInvoke(params);
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.ApiGatewayRestController();

// adding routes for GET, POST and DELETE for job-assignments
restController.addRoute("GET", "/job-assignments", getJobAssignments);
restController.addRoute("POST", "/job-assignments", addJobAssignment);
restController.addRoute("DELETE", "/job-assignments", deleteJobAssignments);
restController.addRoute("GET", "/job-assignments/{id}", getJobAssignment);
restController.addRoute("DELETE", "/job-assignments/{id}", deleteJobAssignment);

// adding routes for GET, POST and DELETE for workflows
restController.addRoute("GET", "/workflows", getWorkflows);
restController.addRoute("POST", "/workflows", addWorkflow);
restController.addRoute("GET", "/workflows/{id}", getWorkflow);
restController.addRoute("DELETE", "/workflows/{id}", deleteWorkflow);

// adding route for notifications from workflow
restController.addRoute("POST", "/job-assignments/{id}/notifications", processNotification);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
