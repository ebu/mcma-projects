import { APIGatewayEvent, Context } from "aws-lambda";
import { JobProfile, Service } from "@mcma/core";
import { DefaultRouteCollection, McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const loggerProvider = new AwsCloudWatchLoggerProvider("service-registry-api-handler", process.env.LogGroupName);
const dbTableProvider = new DynamoDbTableProvider();

const restController =
    new ApiGatewayApiController(
        new McmaApiRouteCollection()
            .addRoutes(new DefaultRouteCollection(dbTableProvider, Service))
            .addRoutes(new DefaultRouteCollection(dbTableProvider, JobProfile)),
        loggerProvider);

export async function handler(event: APIGatewayEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush(Date.now() + context.getRemainingTimeInMillis() - 5000);
    }
}
