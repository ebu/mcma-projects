//"use strict";
const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const SendTaskSuccess = util.promisify(StepFunctions.sendTaskSuccess.bind(StepFunctions));
const SendTaskFailure = util.promisify(StepFunctions.sendTaskFailure.bind(StepFunctions));

const { HttpStatusCode, McmaApiRouteCollection } = require("@mcma/api");
require("@mcma/aws-api-gateway");

// async functions to handle the different routes.

const processNotification = async (requestContext) => {
    const request = requestContext.request;
    const response = requestContext.response;

    console.log("processNotification()", JSON.stringify(request, null, 2));

    let notification = request.body;

    if (!notification) {
        response.statusCode = HttpStatusCode.BAD_REQUEST;
        response.statusMessage = "Missing notification in request body";
        return;
    }

    if (!notification.content) {
        response.statusCode = HttpStatusCode.BAD_REQUEST;
        response.statusMessage = "Missing notification content";
        return;
    }

    if (!notification.content.status) {
        response.statusCode = HttpStatusCode.BAD_REQUEST;
        response.statusMessage = "Missing notification content status";
        return;
    }

    switch (notification.content.status) {
        case "COMPLETED":
            await SendTaskSuccess({
                taskToken: request.queryStringParameters.taskToken,
                output: JSON.stringify(notification.source)
            });
            break;
        case "FAILED":
            let error = notification.content["@type"] + " failed execution";
            let cause = notification.content["@type"] + " with id '" + notification.source + "' failed execution with statusMessage '" + notification.content.statusMessage + "'";

            await SendTaskFailure({
                taskToken: request.queryStringParameters.taskToken,
                error: error,
                cause: JSON.stringify(cause)
            });
            break;
    }
}

// Initializing rest controller for API Gateway Endpoint
const restController =
    new McmaApiRouteCollection()
        .addRoute("POST", "/notifications", processNotification)
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
