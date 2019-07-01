//"use strict";
const { Job } = require("mcma-core");
const { McmaApiRouteCollection, HttpStatusCode } = require("mcma-api");
const { awsDefaultRoutes, invokeLambdaWorker, DynamoDbTable } = require("mcma-aws");

const invokeCreateJobProcess = async (ctx, job) => {
    await invokeLambdaWorker(
        ctx.workerFunctionName(),
        {
            operationName: "createJobProcess",
            contextVariables: ctx.getAllContextVariables(),
            input: {
                jobId: job.id
            }
        });
};

const invokeDeleteJobProcess = async (ctx, job) => {
    if (job.jobProcess) {
        await invokeLambdaWorker(
            ctx.workerFunctionName(),
            {
                operationName: "deleteJobProcess",
                contextVariables: ctx.getAllContextVariables(),
                input: {
                    jobProcessId: job.jobProcess
                }
            });
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
    let table = new DynamoDbTable(Job, requestContext.tableName());

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

    await invokeLambdaWorker(
        requestContext.workerFunctionName(),
        {
            operationName: "ProcessNotification",
            contextVariables: requestContext.getAllContextVariables(),
            input: {
                jobId: job.id,
                notification
            }
        });
}

const routeCollection = new McmaApiRouteCollection();

const jobRoutesBuilder = awsDefaultRoutes(Job).withDynamoDb().addAll();
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