//"use strict";

const AWS = require("aws-sdk");
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
    jobProcess["@type"] = "JobProcess";
    jobProcess.id = jobProcessId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobProcess", jobProcessId, jobProcess);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobProcess.id;
    response.body = jobProcess;

    console.log(JSON.stringify(response, null, 2));
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

const putJobProcess = async (request, response) => {
    console.log("putJobProcess()", JSON.stringify(request, null, 2));

    let jobProcess = request.body;
    if (!jobProcess) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobProcessId = request.stageVariables.PublicUrl + request.path;
    jobProcess["@type"] = "JobProcess";
    jobProcess.id = jobProcessId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobProcess", jobProcessId, jobProcess);

    response.body = jobProcess;
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

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.RestController();

// adding routes
restController.addRoute("GET", "/job-processes", getJobProcesses);
restController.addRoute("POST", "/job-processes", addJobProcess);
restController.addRoute("GET", "/job-processes/{id}", getJobProcess);
restController.addRoute("PUT", "/job-processes/{id}", putJobProcess);
restController.addRoute("DELETE", "/job-processes/{id}", deleteJobProcess);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
