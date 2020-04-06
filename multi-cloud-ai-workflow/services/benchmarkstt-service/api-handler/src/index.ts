import { JobAssignment } from "@mcma/core";
import { DefaultRouteCollectionBuilder } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import "@mcma/aws-api-gateway";

const loggerProvider = new AwsCloudWatchLoggerProvider("benchmarkstt-service-api-handler", process.env.LogGroupName);
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);

const restController =
    new DefaultRouteCollectionBuilder(dbTableProvider, JobAssignment)
        .forJobAssignments(invokeLambdaWorker)
        .toApiGatewayApiController();

export async function handler(event, context) {
    const logger = loggerProvider.get();
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
