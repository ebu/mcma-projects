//"use strict";
const AWS = require("aws-sdk");
const uuidv4 = require("uuid/v4");

const { Job, McmaTracker } = require("@mcma/core");
const { McmaApiRouteCollection, HttpStatusCode, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker } = require("@mcma/aws-lambda-worker-invoker");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-api-gateway");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
require("@mcma/aws-client");

const authProvider = new AuthProvider().addAwsV4Auth(AWS);
const dynamoDbTableProvider = new DynamoDbTableProvider(Job);
const lambdaWorkerInvoker = new LambdaWorkerInvoker();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-repository-api-handler", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

async function validateJob(requestContext) {
    let body = requestContext.getRequestBody();
    if (!body.tracker) {
        let label = body["@type"];

        try {
            const resourceManager = resourceManagerProvider.get(requestContext);
            const jobProfile = await resourceManager.get(body.jobProfile);
            label += " with JobProfile " + jobProfile.name;
        } catch (error) {
            loggerProvider.get().error(error);
            label += " with unknown JobProfile";
        }

        body.tracker = new McmaTracker({ id: uuidv4(), label });
    }
    return true;
}

async function invokeCreateJobProcess(requestContext, job) {
    await lambdaWorkerInvoker.invoke(
        requestContext.workerFunctionId(),
        "CreateJobProcess",
        requestContext.getAllContextVariables(),
        {
            jobId: job.id
        },
        job.tracker,
    );
}

async function invokeDeleteJobProcess(requestContext, job) {
    if (job.jobProcess) {
        await lambdaWorkerInvoker.invoke(
            requestContext.workerFunctionId(),
            "DeleteJobProcess",
            requestContext.getAllContextVariables(),
            {
                jobProcessId: job.jobProcess
            }
        );
    }
}

async function stopJob(requestContext) {
    requestContext.setResponseCode(HttpStatusCode.NOT_IMPLEMENTED, "Stopping job is not implemented");
}

async function cancelJob(requestContext) {
    requestContext.setResponseCode(HttpStatusCode.NOT_IMPLEMENTED, "Canceling job is not implemented");
}

const processNotification = async (requestContext) => {
    let table = dynamoDbTableProvider.get(requestContext.tableName());

    let job = await table.get(requestContext.publicUrl() + "/jobs/" + requestContext.request.pathVariables.id);
    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    if (job.jobProcess && job.jobProcess !== notification.source) {
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
            notification,
        },
        job.tracker,
    );
};

const routeCollection = new McmaApiRouteCollection();

const jobRoutesBuilder = new DefaultRouteCollectionBuilder(dynamoDbTableProvider, Job).addAll();
jobRoutesBuilder.route(r => r.create).configure(r => r.onStarted(validateJob).onCompleted(invokeCreateJobProcess));
jobRoutesBuilder.route(r => r.update).remove();
jobRoutesBuilder.route(r => r.delete).configure(r => r.onCompleted(invokeDeleteJobProcess));

const jobRoutes = jobRoutesBuilder.build();

routeCollection.addRoutes(jobRoutes)
               .addRoute("POST", "/jobs/{id}/stop", stopJob)
               .addRoute("POST", "/jobs/{id}/cancel", cancelJob)
               .addRoute("POST", "/jobs/{id}/notifications", processNotification);

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
