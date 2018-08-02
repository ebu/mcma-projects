//"use strict";
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const SendTaskSuccess = util.promisify(StepFunctions.sendTaskSuccess.bind(StepFunctions));
const SendTaskFailure = util.promisify(StepFunctions.sendTaskFailure.bind(StepFunctions));

const MCMA_AWS = require("mcma-aws");

// async functions to handle the different routes.

const processNotification = async (request, response) => {
    console.log("processNotification()", JSON.stringify(request, null, 2));

    let notification = request.body;

    if (!notification) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification in request body";
        return;
    }

    if (!notification.content) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification content";
        return;
    }

    if (!notification.content.status) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification content status";
        return;
    }

    switch (notification.content.status) {
        case "COMPLETED":
            await SendTaskSuccess({ taskToken: request.queryStringParameters.taskToken, output: JSON.stringify(notification.source) });
            break;
        case "FAILED":
            await SendTaskFailure({ taskToken: request.queryStringParameters.taskToken, error: notification.content["@type"] + " failed execution with statusMessage '" + notification.content.statusMessage + "'", cause: notification.source });
            break;
    }
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.ApiGatewayRestController();

// adding routes
restController.addRoute("POST", "/notifications", processNotification);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
