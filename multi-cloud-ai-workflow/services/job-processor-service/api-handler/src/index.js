//"use strict";
const { Job, JobProcess } = require("mcma-core");
const { McmaApiRouteCollection, HttpStatusCode } = require("mcma-api");
const { invokeLambdaWorker, DynamoDbTable, awsDefaultRoutes } = require("mcma-aws");

const invokeCreateJobAssignment = async (ctx, jobProcess) => {
    await invokeLambdaWorker(
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
    await invokeLambdaWorker(
        requestContext.workerFunctionName(),
        {
            operationName: "ProcessNotification",
            contextVariables: requestContext.getAllContextVariables(),
            input: {
                jobProcessId,
                notification
            }
        });
}

const routeCollection = new McmaApiRouteCollection();

const jobProcessRouteBuilder = awsDefaultRoutes(JobProcess).withDynamoDb().addAll();
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
