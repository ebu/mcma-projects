//"use strict";
import * as AWS from "aws-sdk";
import { Context, APIGatewayProxyEvent } from "aws-lambda";
const StepFunctions = new AWS.StepFunctions();

import { JobStatus } from "@mcma/core";
import { HttpStatusCode, McmaApiRouteCollection, McmaApiRequestContext } from "@mcma/api";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const loggerProvider = new AwsCloudWatchLoggerProvider("workflow-activity-callback-handler", process.env.LogGroupName);

async function processNotification(requestContext: McmaApiRequestContext) {
    const request = requestContext.request;
    const response = requestContext.response;

    let notification = request.body;

    if (!notification) {
        response.statusCode = HttpStatusCode.BadRequest;
        response.statusMessage = "Missing notification in request body";
        return;
    }

    if (!notification.content) {
        response.statusCode = HttpStatusCode.BadRequest;
        response.statusMessage = "Missing notification content";
        return;
    }

    if (!notification.content.status) {
        response.statusCode = HttpStatusCode.BadRequest;
        response.statusMessage = "Missing notification content status";
        return;
    }

    const logger = loggerProvider.get(notification.content.tracker);
    logger.info("Received update with status " + notification.content.status + " for job id: " + notification.source);

    switch (notification.content.status) {
        case JobStatus.Completed:
            await StepFunctions.sendTaskSuccess({
                taskToken: request.queryStringParameters.taskToken,
                output: JSON.stringify(notification.source)
            }).promise();
            break;
        case JobStatus.Failed:
            const error = notification.content["@type"] + " failed execution";
            const cause = notification.content["@type"] + " with id '" + notification.source + "' failed execution with statusMessage '" + notification.content.statusMessage + "'";

            await StepFunctions.sendTaskFailure({
                taskToken: request.queryStringParameters.taskToken,
                error: error,
                cause: JSON.stringify(cause)
            }).promise();
            break;
    }
};

// Initializing rest controller for API Gateway Endpoint
const restController =
    new ApiGatewayApiController(
        new McmaApiRouteCollection()
            .addRoute("POST", "/notifications", processNotification));

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    const logger = loggerProvider.get();
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(event);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
