//"use strict";

const AWS = require("aws-sdk");
const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

async function getJobs (request, response) {
    console.log("getJobs()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("Job");
    
    console.log(JSON.stringify(response, null, 2));
}

async function addJob (request, response) {
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

    let jobId = uuidv4();
    job.id = request.stageVariables.PublicUrl + "/jobs/" + jobId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("Job", jobId, job);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = job.id;
    response.body = job;

    console.log(JSON.stringify(response, null, 2));
}

async function getJob (request, response) {
    console.log("getJob()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);
    
    response.body = await table.get("Job", request.pathVariables.id);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

async function putJob (request, response) {
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

    let jobId = request.pathVariables.id;
    job.id = request.stageVariables.PublicUrl + "/jobs/" + jobId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("Job", jobId, job);

    response.body = job;
}

async function deleteJob (request, response) {
    console.log("deleteJob()", JSON.stringify(request, null, 2));

    let jobId = request.pathVariables.id;
    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let job = await table.get("Job", jobId);
    if (!job) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    } 

    await table.delete("Job", jobId);
}

// Initializing rest controller for API Gateway Endpoint
let restController = new MCMA_AWS.RestController();

// adding routes
restController.addRoute("GET", "/jobs", getJobs);
restController.addRoute("POST", "/jobs", addJob);
restController.addRoute("GET", "/jobs/{id}", getJob);
restController.addRoute("PUT", "/jobs/{id}", putJob);
restController.addRoute("DELETE", "/jobs/{id}", deleteJob);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}