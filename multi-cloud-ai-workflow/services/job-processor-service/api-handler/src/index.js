//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

const getJobProcesses = async (request, response) => {
    console.log("getJobProcesss()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("JobProcess");

    console.log(JSON.stringify(response, null, 2));
}

const addJobProcess = async (request, response) => {
    console.log("addJobProcess()", JSON.stringify(request, null, 2));

    let jobProcess = request.body;
    if (!jobProcess) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobProcessId = request.stageVariables.PublicUrl + "/job-processes/" + uuidv4();
    if (jobProcess["@type"] !== "JobProcess") {
        jobProcess["@type"] = "JobProcess";
    }
    jobProcess.id = jobProcessId;
    jobProcess.status = "NEW";

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobProcess", jobProcessId, jobProcess);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobProcess.id;
    response.body = jobProcess;

    console.log(JSON.stringify(response, null, 2));

    // invoking worker lambda function that will find a service that can execute the job and send it a JobAssignment
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "action": "createJobAssignment", "request": request, "jobProcessId": jobProcessId })
    };

    await LambdaInvoke(params);
}

const getJobProcess = async (request, response) => {
    console.log("getJobProcess()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProcessId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("JobProcess", jobProcessId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const deleteJobProcess = async (request, response) => {
    console.log("deleteJobProcess()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProcessId = request.stageVariables.PublicUrl + request.path;

    let jobProcess = await table.get("JobProcess", jobProcessId);
    if (!jobProcess) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("JobProcess", jobProcessId);
}

const processNotification = async (request, response) => {
    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProcessId = request.stageVariables.PublicUrl + "/job-processes/" + request.pathVariables.id;

    let jobProcess = await table.get("JobProcess", jobProcessId);
    if (!jobProcess) {
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

    if (jobProcess.jobAssignment !== notification.source) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    // invoking worker lambda function that will process the notification
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "action": "processNotification", "request": request, "jobProcessId": jobProcessId, "notification": notification })
    };

    await LambdaInvoke(params);
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.RestController();

// adding routes for GET POST and DELETE of JobProcesses
restController.addRoute("GET", "/job-processes", getJobProcesses);
restController.addRoute("POST", "/job-processes", addJobProcess);
restController.addRoute("GET", "/job-processes/{id}", getJobProcess);
restController.addRoute("DELETE", "/job-processes/{id}", deleteJobProcess);

// adding route for callback notifications
restController.addRoute("DELETE", "/job-processes/{id}/notifications", processNotification);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
