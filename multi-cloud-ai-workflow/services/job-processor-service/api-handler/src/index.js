//"use strict";
const { JobProcess } = require("mcma-core");
const { McmaApiRouteCollection, HttpStatusCode } = require("mcma-api");
const { invokeLambdaWorker, DynamoDbTable } = require("mcma-aws");

const workerInvoker = new invokeLambdaWorker();

const invokeCreateJobAssignment = async (ctx, jobProcess) => {
    await workerInvoker.invoke(
        ctx.workerFunctionName(),
        {
            operationName: "createJobAssignment",
            contextVariables: ctx.getAllContextVariables(),
            input: {
                jobProcessId: jobProcess.id
            }
        });
}

const processNotification = async (requestContext) => {
    let table = new DynamoDbTable(Job, requestContext.tableName());

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
        response.statusCode = HttpStatusCode.BAD_REQUEST;
        response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    // invoking worker lambda function that will process the notification
    await workerInvoker.invoke(
        requestContext.workerFunctionName(),
        {
            operationName: "ProcessNotification",
            contextVariables: request.getAllContextVariables(),
            input: {
                jobProcessId,
                notification
            }
        });
}

const routeCollection = new McmaApiRouteCollection();

const jobProcessRoutes = awsDefaultRoutes(JobProcess).withDynamoDb().addAll();
jobProcessRoutes.route(r => r.create).configure(r => r.onCompleted(invokeCreateJobAssignment));
jobProcessRoutes.route(r => r.update).remove();

routeCollection.addRoutes(jobProcessRoutes);
routeCollection.addRoute("POST", "/job-processes/{id}/notifications", processNotification);

const restController = routeCollection.toApiGatewayApiController();

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
