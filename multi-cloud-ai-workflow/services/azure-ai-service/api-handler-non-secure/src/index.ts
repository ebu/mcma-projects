import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { getTableName } from "@mcma/data";
import { HttpStatusCode, McmaApiRequestContext, McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";
import { getWorkerFunctionId } from "@mcma/worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { EnvironmentVariables } from "@mcma/core";

const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("azure-ai-service-api-handler-non-secure", process.env.LogGroupName);

async function processNotification(requestContext: McmaApiRequestContext) {
    const request = requestContext.request;

    const table = await dbTableProvider.get(getTableName(EnvironmentVariables.getInstance()));

    const jobAssignmentDatabaseId = "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentDatabaseId);
    if (!jobAssignment) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = request.queryStringParameters;
    if (!notification) {
        requestContext.setResponseStatusCode(HttpStatusCode.BadRequest, "Missing notification in request Query String");
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
            tracker: jobAssignment.tracker
        }
    );
}

const restController =
    new ApiGatewayApiController(
        new McmaApiRouteCollection().addRoute("POST", "/job-assignments/{id}/notifications", processNotification), loggerProvider, EnvironmentVariables.getInstance());

export async function handler(event: APIGatewayProxyEvent, context: Context) {
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
