//"use strict";
import { APIGatewayEvent, Context } from "aws-lambda";
import { defaultRoutesForJobs } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const loggerProvider = new AwsCloudWatchLoggerProvider("azure-ai-service-api-handler", process.env.LogGroupName);
const dbTableProvider = new DynamoDbTableProvider();

const restController =
    new ApiGatewayApiController(defaultRoutesForJobs(dbTableProvider, invokeLambdaWorker).build());

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
