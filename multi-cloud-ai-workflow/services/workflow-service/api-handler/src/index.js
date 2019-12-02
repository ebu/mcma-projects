//"use strict";
const { JobAssignment } = require("@mcma/core");
const { DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker, invokeLambdaWorker } = require("@mcma/aws-lambda-worker-invoker");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-api-gateway");

const dbTableProvider = new DynamoDbTableProvider(JobAssignment);
const loggerProvider = new AwsCloudWatchLoggerProvider("workflow-service-api-handler", process.env.LogGroupName);
const workerInvoker = new LambdaWorkerInvoker();

async function processNotification(requestContext) {
    const request = requestContext.request;

    const table = dbTableProvider.get(requestContext.tableName());

    const jobAssignmentId = requestContext.publicUrl() + "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentId);
    if (!jobAssignment) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    const notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    await workerInvoker.invoke(
        requestContext.workerFunctionId(),
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
    new DefaultRouteCollectionBuilder(dbTableProvider, JobAssignment)
        .forJobAssignments(invokeLambdaWorker)
        .addRoute("POST", "/job-assignments/{id}/notifications", processNotification)
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
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
