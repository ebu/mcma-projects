import { defaultRoutesForJobs } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

const loggerProvider = new AwsCloudWatchLoggerProvider("benchmarkstt-service-api-handler", process.env.LogGroupName);
const dbTableProvider = new DynamoDbTableProvider();

const restController = new ApiGatewayApiController(defaultRoutesForJobs(dbTableProvider, invokeLambdaWorker).build(), loggerProvider);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } catch (error) {
        logger.error(error);
        throw error;
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
