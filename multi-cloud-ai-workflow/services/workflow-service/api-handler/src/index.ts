import { APIGatewayEvent, Context } from "aws-lambda";
import { EnvironmentVariables } from "@mcma/core";
import { getTableName } from "@mcma/data";
import { DefaultJobRouteCollection, McmaApiRequestContext } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { getWorkerFunctionId } from "@mcma/worker-invoker";

const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("workflow-service-api-handler", process.env.LogGroupName);

async function processNotification(requestContext: McmaApiRequestContext) {
    const request = requestContext.request;

    const table = await dbTableProvider.get(getTableName(EnvironmentVariables.getInstance()));

    const jobAssignmentDatabaseId = "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentDatabaseId);
    if (!jobAssignment) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    const notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    await invokeLambdaWorker(
        getWorkerFunctionId(EnvironmentVariables.getInstance()),
        {
            operationName: "ProcessNotification",
            input: {
                jobAssignmentDatabaseId,
                notification
            },
            tracker: jobAssignment.tracker,
        }
    );
}

const routes = new DefaultJobRouteCollection(dbTableProvider, invokeLambdaWorker)
    .addRoute("POST", "/job-assignments/{id}/notifications", processNotification);

const restController = new ApiGatewayApiController(routes, loggerProvider, EnvironmentVariables.getInstance());

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
