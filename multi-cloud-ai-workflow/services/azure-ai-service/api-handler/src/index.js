//"use strict";
const { Logger, JobAssignment } = require("@mcma/core");
const { DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { invokeLambdaWorker } = require("@mcma/aws-lambda-worker-invoker");
require("@mcma/aws-api-gateway");

const restController =
    new DefaultRouteCollectionBuilder(new DynamoDbTableProvider(JobAssignment), JobAssignment)
        .forJobAssignments(invokeLambdaWorker)
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    Logger.debug(JSON.stringify(event, null, 2));
    Logger.debug(JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}