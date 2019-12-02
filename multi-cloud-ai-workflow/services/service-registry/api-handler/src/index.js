//"use strict";
const { Service, JobProfile } = require("@mcma/core");
const { McmaApiRouteCollection, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-api-gateway");

const loggerProvider = new AwsCloudWatchLoggerProvider("service-registry-api-handler", process.env.LogGroupName);
const serviceDbTableProvider = new DynamoDbTableProvider(Service);
const profileDbTableProvider = new DynamoDbTableProvider(JobProfile);

const restController =
    new McmaApiRouteCollection()
        .addRoutes(new DefaultRouteCollectionBuilder(serviceDbTableProvider, Service).addAll().build())
        .addRoutes(new DefaultRouteCollectionBuilder(profileDbTableProvider, JobProfile).addAll().build())
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
