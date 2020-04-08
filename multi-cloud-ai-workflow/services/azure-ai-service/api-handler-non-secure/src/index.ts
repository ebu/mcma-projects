//"use strict";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { JobAssignment, getTableName } from "@mcma/core";
import { McmaApiRouteCollection, McmaApiRequestContext, getPublicUrl, HttpStatusCode, getWorkerFunctionId } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("azure-ai-service-api-handler-non-secure", process.env.LogGroupName);
const workerInvoker = new LambdaWorkerInvoker();

async function processNotification(requestContext: McmaApiRequestContext) {
    const request = requestContext.request;

    const table = dbTableProvider.get(getTableName(requestContext), JobAssignment);

    const jobAssignmentId = getPublicUrl(requestContext) + "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentId);
    if (!jobAssignment) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = request.queryStringParameters;
    if (!notification) {
        requestContext.setResponseStatusCode(HttpStatusCode.BadRequest, "Missing notification in request Query String");
        return;
    }

    await workerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobAssignmentId,
            notification
        },
        jobAssignment.tracker,
    );
}

const restController =
    new ApiGatewayApiController(
        new McmaApiRouteCollection().addRoute("POST", "/job-assignments/{id}/notifications", processNotification));

export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
    const logger = loggerProvider.get();
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
