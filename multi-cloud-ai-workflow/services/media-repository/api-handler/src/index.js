//"use strict";
const { BMContent, BMEssence } = require("@mcma/core");
const { McmaApiRouteCollection, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-api-gateway");

const loggerProvider = new AwsCloudWatchLoggerProvider("service-registry-api-handler", process.env.LogGroupName);
const bmContentDbTableProvider = new DynamoDbTableProvider(BMContent);
const bmEssenceDbTableProvider = new DynamoDbTableProvider(BMEssence);

const restController =
    new McmaApiRouteCollection()
        .addRoutes(new DefaultRouteCollectionBuilder(bmContentDbTableProvider, BMContent,"bm-contents").addAll().build())
        .addRoutes(new DefaultRouteCollectionBuilder(bmEssenceDbTableProvider, BMEssence,"bm-essences").addAll().build())
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    const logger = loggerProvider.get();
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(event);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
