//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
var Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
var LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

async function getJobAssignments(request, response) {
    console.log("getJobAssignments()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("JobAssignment");

    console.log(JSON.stringify(response, null, 2));
}

async function addJobAssignment(request, response) {
    console.log("addJobAssignment()", JSON.stringify(request, null, 2));

    let jobAssignment = request.body;
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobAssignmentId = uuidv4();
    jobAssignment["@type"] = "JobAssignment";
    jobAssignment.id = request.stageVariables.PublicUrl + "/job-assignments/" + jobAssignmentId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobAssignment.id;
    response.body = jobAssignment;

    console.log(JSON.stringify(response, null, 2));

    // invoking worker lambda
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "request": request, "jobAssignment": jobAssignment })
    };

    await LambdaInvoke(params);
}

async function getJobAssignment(request, response) {
    console.log("getJobAssignment()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.get("JobAssignment", request.pathVariables.id);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

async function deleteJobAssignment(request, response) {
    console.log("deleteJobAssignment()", JSON.stringify(request, null, 2));

    let jobAssignmentId = request.pathVariables.id;
    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("JobAssignment", jobAssignmentId);
}

// Initializing rest controller for API Gateway Endpoint
let restController = new MCMA_AWS.RestController();

// adding routes
restController.addRoute("GET", "/job-assignments", getJobAssignments);
restController.addRoute("POST", "/job-assignments", addJobAssignment);
restController.addRoute("GET", "/job-assignments/{id}", getJobAssignment);
restController.addRoute("DELETE", "/job-assignments/{id}", deleteJobAssignment);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
