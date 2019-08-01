//"use strict";
const { Logger, JobAssignment } = require("@mcma/core");
const { McmaApiRouteCollection, HttpStatusCode } = require("@mcma/api");
const { DynamoDbTable } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker } = require("@mcma/aws-lambda-worker-invoker");
require("@mcma/aws-api-gateway");

const workerInvoker = new LambdaWorkerInvoker();

const processNotification = async (requestContext) => {
    const request = requestContext.request;
    const response = requestContext.response;

    Logger.debug("processNotification()", JSON.stringify(request, null, 2));

    const table = new DynamoDbTable(JobAssignment, requestContext.tableName());

    const jobAssignmentId = requestContext.publicUrl() + "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentId);

    Logger.debug("jobAssignment = ", jobAssignment);

    if (!jobAssignment) {
        Logger.debug("jobAssignment not found", jobAssignment);
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = request.queryStringParameters;
    Logger.debug("notification = ", notification);
    if (!notification) {
        response.statusCode = HttpStatusCode.BAD_REQUEST;
        response.statusMessage = "Missing notification in request Query String";
        return;
    }

    // invoking worker lambda function that will process the notification
    await workerInvoker.invoke(
        requestContext.workerFunctionId(),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobAssignmentId,
            notification
        }
    );
}

// Initializing rest controller for API Gateway Endpoint
const routeCollection = new McmaApiRouteCollection().addRoute("POST", "/job-assignments/{id}/notifications", processNotification);
const apiController = routeCollection.toApiGatewayApiController();

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await apiController.handleRequest(event, context);
}
