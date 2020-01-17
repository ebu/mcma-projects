//"use strict";
const { JobAssignment } = require("@mcma/core");
const { DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { invokeLambdaWorker } = require("@mcma/aws-lambda-worker-invoker");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-api-gateway");

const loggerProvider = new AwsCloudWatchLoggerProvider("transform-service-api-handler", process.env.LogGroupName);
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);

const restController =
    new DefaultRouteCollectionBuilder(dbTableProvider, JobAssignment)
        .forJobAssignments(invokeLambdaWorker)
        .toApiGatewayApiController();

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
