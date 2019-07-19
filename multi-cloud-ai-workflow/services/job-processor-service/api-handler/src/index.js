//"use strict";
const { JobProcess } = require("@mcma/core");
const { McmaApiRouteCollection, HttpStatusCode, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider, DynamoDbTable } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker } = require("@mcma/aws-lambda-worker-invoker");
require("@mcma/aws-api-gateway");

const workerInvoker = new LambdaWorkerInvoker();

const invokeCreateJobAssignment = async (ctx, jobProcess) => {
    await workerInvoker.invoke(
        ctx.workerFunctionId(),
        "createJobAssignment",
        ctx.getAllContextVariables(),
        {
            jobProcessId: jobProcess.id
        }
    );
}

const processNotification = async (requestContext) => {
    let table = new DynamoDbTable(JobProcess, requestContext.tableName());

    let jobProcessId = requestContext.publicUrl() + "/job-processes/" + requestContext.request.pathVariables.id;

    let jobProcess = await table.get(jobProcessId);
    if (!requestContext.resourceIfFound(jobProcess, false)) {
        return;
    }

    let notification = requestContext.isBadRequestDueToMissingBody();
    if (!notification) {
        return;
    }

    if (jobProcess.jobAssignment !== notification.source) {
        requestContext.response.statusCode = HttpStatusCode.BAD_REQUEST;
        requestContext.response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    // invoking worker lambda function that will process the notification
    await workerInvoker.invoke(
        requestContext.workerFunctionId(),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobProcessId,
            notification
        });
}

const routeCollection = new McmaApiRouteCollection();

const jobProcessRouteBuilder = new DefaultRouteCollectionBuilder(new DynamoDbTableProvider(JobProcess), JobProcess).addAll();
jobProcessRouteBuilder.route(r => r.create).configure(r => r.onCompleted(invokeCreateJobAssignment));
jobProcessRouteBuilder.route(r => r.update).remove();
const jobProcessRoutes = jobProcessRouteBuilder.build();

routeCollection.addRoutes(jobProcessRoutes);
routeCollection.addRoute("POST", "/job-processes/{id}/notifications", processNotification);

const restController = routeCollection.toApiGatewayApiController();

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
