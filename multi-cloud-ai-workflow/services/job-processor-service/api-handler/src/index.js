//"use strict";
const uuidv4 = require("uuid/v4");

const { JobProcess, McmaTracker } = require("@mcma/core");
const { McmaApiRouteCollection, HttpStatusCode, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider, DynamoDbTable } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker } = require("@mcma/aws-lambda-worker-invoker");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-api-gateway");

const dbTableProvider = new DynamoDbTableProvider(JobProcess);
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-service-api-handler", process.env.LogGroupName);
const workerInvoker = new LambdaWorkerInvoker();

async function validateJobProcess(requestContext) {
    let body = requestContext.getRequestBody();
    if (!body.tracker) {
        body.tracker = new McmaTracker({ id: uuidv4(), label: body["@type"] });
    }
    return true;
}

async function invokeCreateJobAssignment(requestContext, jobProcess) {
    await workerInvoker.invoke(
        requestContext.workerFunctionId(),
        "CreateJobAssignment",
        requestContext.getAllContextVariables(),
        {
            jobProcessId: jobProcess.id
        },
        jobProcess.tracker,
    );
}

async function invokeDeleteJobAssignment(requestContext, jobProcess) {
    await workerInvoker.invoke(
        requestContext.workerFunctionId(),
        "DeleteJobAssignment",
        requestContext.getAllContextVariables(),
        {
            jobAssignmentId: jobProcess.jobAssignment
        },
        jobProcess.tracker,
    );
}

async function processNotification(requestContext) {
    let table = new DynamoDbTable(requestContext.tableName(), JobProcess);

    let jobProcessId = requestContext.publicUrl() + "/job-processes/" + requestContext.request.pathVariables.id;

    let jobProcess = await table.get(jobProcessId);
    if (!jobProcess) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    if (jobProcess.jobAssignment && jobProcess.jobAssignment !== notification.source) {
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
        },
        jobProcess.tracker,
    );
}

const routeCollection = new McmaApiRouteCollection();

const jobProcessRouteBuilder = new DefaultRouteCollectionBuilder(dbTableProvider, JobProcess).addAll();
jobProcessRouteBuilder.route(r => r.create).configure(r => r.onStarted(validateJobProcess).onCompleted(invokeCreateJobAssignment));
jobProcessRouteBuilder.route(r => r.update).remove();
jobProcessRouteBuilder.route(r => r.delete).configure(r => r.onCompleted(invokeDeleteJobAssignment));

const jobProcessRoutes = jobProcessRouteBuilder.build();

routeCollection.addRoutes(jobProcessRoutes);
routeCollection.addRoute("POST", "/job-processes/{id}/notifications", processNotification);

const restController = routeCollection.toApiGatewayApiController();

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
