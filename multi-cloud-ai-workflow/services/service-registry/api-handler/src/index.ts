//"use strict";
import { APIGatewayEvent, Context } from "aws-lambda";
import { Service, JobProfile } from "@mcma/core";
import { McmaApiRouteCollection, DefaultRouteCollectionBuilder } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const loggerProvider = new AwsCloudWatchLoggerProvider("service-registry-api-handler", process.env.LogGroupName);
const dbTableProvider = new DynamoDbTableProvider();

const restController =
    new ApiGatewayApiController(
        new McmaApiRouteCollection()
            .addRoutes(new DefaultRouteCollectionBuilder(dbTableProvider, Service).addAll().build())
            .addRoutes(new DefaultRouteCollectionBuilder(dbTableProvider, JobProfile).addAll().build()));

export async function handler(event: APIGatewayEvent, context: Context) {
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
