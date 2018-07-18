//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

const getJobs = async (request, response) => {
    console.log("getJobs()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("Job");

    console.log(JSON.stringify(response, null, 2));
}

const addJob = async (request, response) => {
    console.log("addJob()", JSON.stringify(request, null, 2));

    let job = request.body;
    if (!job) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    if (!job["@type"]) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing '@type' property.";
        return;
    }

    let jobId = request.stageVariables.PublicUrl + "/jobs/" + uuidv4();
    job.id = jobId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("Job", jobId, job);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = job.id;
    response.body = job;

    console.log(JSON.stringify(response, null, 2));

    // invoking worker lambda function that will create a job process for this new job
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "request": request, "jobId": jobId })
    };

    await LambdaInvoke(params);
}

const getJob = async (request, response) => {
    console.log("getJob()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("Job", jobId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const putJob = async (request, response) => {
    console.log("putJob()", JSON.stringify(request, null, 2));

    let job = request.body;
    if (!job) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    if (!job["@type"]) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing '@type' property.";
        return;
    }

    let jobId = request.stageVariables.PublicUrl + request.path;
    job.id = jobId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("Job", jobId, job);

    response.body = job;
}

const deleteJob = async (request, response) => {
    console.log("deleteJob()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobId = request.stageVariables.PublicUrl + request.path;

    let job = await table.get("Job", jobId);
    if (!job) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("Job", jobId);
}

const stopJob = async (request, response) => {
    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobId = request.stageVariables.PublicUrl + "/jobs/" + request.pathVariables.id;
    
    let job = await table.get("Job", jobId);
    if (!job) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    response.statusCode = MCMA_AWS.HTTP_NOT_IMPLEMENTED;
    response.statusMessage = "Stopping job is not implemented";
}

const cancelJob = async (request, response) => {
    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobId = request.stageVariables.PublicUrl + "/jobs/" + request.pathVariables.id;
    
    let job = await table.get("Job", jobId);
    if (!job) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    response.statusCode = MCMA_AWS.HTTP_NOT_IMPLEMENTED;
    response.statusMessage = "Canceling job is not implemented";
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.RestController();

// adding routes
restController.addRoute("GET", "/jobs", getJobs);
restController.addRoute("POST", "/jobs", addJob);
restController.addRoute("GET", "/jobs/{id}", getJob);
restController.addRoute("PUT", "/jobs/{id}", putJob);
restController.addRoute("DELETE", "/jobs/{id}", deleteJob);

restController.addRoute("POST", "/jobs/{id}/stop", stopJob);
restController.addRoute("POST", "/jobs/{id}/cancel", cancelJob);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
