//"use strict";
const { Job } = require("@mcma/core");
const { McmaApiRouteCollection, HttpStatusCode, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker } = require("@mcma/aws-lambda-worker-invoker");
require("@mcma/aws-api-gateway");

const dynamoDbTableProvider = new DynamoDbTableProvider(Job);
const lambdaWorkerInvoker = new LambdaWorkerInvoker();

const invokeCreateJobProcess = async (ctx, job) => {
    await lambdaWorkerInvoker.invoke(
        ctx.workerFunctionId(),
        "createJobProcess",
        ctx.getAllContextVariables(),
        {
            jobId: job.id
        }
    );
};

const invokeDeleteJobProcess = async (ctx, job) => {
    if (job.jobProcess) {
        await lambdaWorkerInvoker.invoke(
            ctx.workerFunctionId(),
            "deleteJobProcess",
            ctx.getAllContextVariables(),
            {
                jobProcessId: job.jobProcess
            }
        );
    }
};

const stopJob = async (_request, response) => {
    response.statusCode = HttpStatusCode.NOT_IMPLEMENTED;
    response.statusMessage = "Stopping job is not implemented";
};

const cancelJob = async (_request, response) => {
    response.statusCode = HttpStatusCode.NOT_IMPLEMENTED;
    response.statusMessage = "Canceling job is not implemented";
};

const processNotification = async (requestContext) => {
    let table = dynamoDbTableProvider.table(requestContext.tableName());

    let job = await table.get(requestContext.publicUrl() + "/jobs/" + requestContext.request.pathVariables.id);
    if (!requestContext.resourceIfFound(job, false)) {
        return;
    }

    let notification = requestContext.isBadRequestDueToMissingBody();
    if (!notification) {
        return;
    }

    if (job.jobProcess !== notification.source) {
        requestContext.response.statusCode = HttpStatusCode.BAD_REQUEST;
        requestContext.response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    await lambdaWorkerInvoker.invoke(
        requestContext.workerFunctionId(),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobId: job.id,
            notification
        }
    );
}

const routeCollection = new McmaApiRouteCollection();

const jobRoutesBuilder = new DefaultRouteCollectionBuilder(dynamoDbTableProvider, Job).addAll();
jobRoutesBuilder.route(r => r.create).configure(r => r.onCompleted(invokeCreateJobProcess));
jobRoutesBuilder.route(r => r.delete).configure(r => r.onCompleted(invokeDeleteJobProcess));
const jobRoutes = jobRoutesBuilder.build();

routeCollection.addRoutes(jobRoutes)
    .addRoute("POST", "/jobs/{id}/stop", stopJob)
    .addRoute("POST", "/jobs/{id}/cancel", cancelJob)
    .addRoute("POST", "/jobs/{id}/notifications", processNotification);

const restController = routeCollection.toApiGatewayApiController();

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}