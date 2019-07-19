//"use strict";
const { Logger, JobAssignment } = require("@mcma/core");
const { DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { LambdaWorkerInvoker, invokeLambdaWorker } = require("@mcma/aws-lambda-worker-invoker");
require("@mcma/aws-api-gateway");

const { processNotification } = require("./routes/process-notification");

const dbTableProvider = new DynamoDbTableProvider(JobAssignment);
const workerInvoker = new LambdaWorkerInvoker();

const restController =
    new DefaultRouteCollectionBuilder(dbTableProvider, JobAssignment)
        .forJobAssignments(invokeLambdaWorker)
        .addRoute("POST", "/job-assignments/{id}/notifications", processNotification(dbTableProvider, workerInvoker))
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    Logger.debug(JSON.stringify(event, null, 2));
    Logger.debug(JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}