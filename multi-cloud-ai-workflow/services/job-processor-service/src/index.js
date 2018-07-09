//"use strict";

const AWS = require("aws-sdk");
const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

async function getJobProcesses (request, response) {
    console.log("getJobProcesss()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("JobProcess");
    
    console.log(JSON.stringify(response, null, 2));
}

async function addJobProcess (request, response) {
    console.log("addJobProcess()", JSON.stringify(request, null, 2));

    let jobProcess = request.body;
    if (!jobProcess) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobProcessId = uuidv4();
    jobProcess["@type"] = "JobProcess";
    jobProcess.id = request.stageVariables.PublicUrl + "/job-processes/" + jobProcessId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobProcess", jobProcessId, jobProcess);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobProcess.id;
    response.body = jobProcess;

    console.log(JSON.stringify(response, null, 2));
}

async function getJobProcess (request, response) {
    console.log("getJobProcess()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);
    
    response.body = await table.get("JobProcess", request.pathVariables.id);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

async function putJobProcess (request, response) {
    console.log("putJobProcess()", JSON.stringify(request, null, 2));

    let jobProcess = request.body;
    if (!jobProcess) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobProcessId = request.pathVariables.id;
    jobProcess["@type"] = "JobProcess";
    jobProcess.id = request.stageVariables.PublicUrl + "/job-processes/" + jobProcessId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobProcess", jobProcessId, jobProcess);

    response.body = jobProcess;
}

async function deleteJobProcess (request, response) {
    console.log("deleteJobProcess()", JSON.stringify(request, null, 2));

    let jobProcessId = request.pathVariables.id;
    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProcess = await table.get("JobProcess", jobProcessId);
    if (!jobProcess) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    } 

    await table.delete("JobProcess", jobProcessId);
}

// Initializing rest controller for API Gateway Endpoint
let restController = new MCMA_AWS.RestController();

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
