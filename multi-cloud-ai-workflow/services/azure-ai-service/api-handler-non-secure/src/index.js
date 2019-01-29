//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');


const processNotification = async (request, response) => {
    console.log("processNotification()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + "/job-assignments/" + request.pathVariables.id;

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);

    console.log("jobAssignment = ", jobAssignment);

    if (!jobAssignment) {
        console.log("jobAssignment not found", jobAssignment);
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    let notification = request.queryStringParameters;
    console.log("notification = ", notification);
    if (!notification) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification in request Query String";
        return;
    }

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

    console.log("Invoking Lambda : ", params);

    await LambdaInvoke(params);
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.ApiGatewayRestController();

// adding routes for GET, POST and DELETE
// restController.addRoute("GET", "/job-assignments", getJobAssignments);
// restController.addRoute("POST", "/job-assignments", addJobAssignment);
// restController.addRoute("DELETE", "/job-assignments", deleteJobAssignments);
// restController.addRoute("GET", "/job-assignments/{id}", getJobAssignment);
// restController.addRoute("DELETE", "/job-assignments/{id}", deleteJobAssignment);

// adding route for notifications from azure ai service
restController.addRoute("POST", "/job-assignments/{id}/notifications", processNotification);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
