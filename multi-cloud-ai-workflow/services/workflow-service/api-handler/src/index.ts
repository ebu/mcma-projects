import { APIGatewayEvent, Context } from "aws-lambda";
import { getTableName, JobAssignment } from "@mcma/core";
import { defaultRoutesForJobs, getPublicUrl, getWorkerFunctionId, McmaApiRequestContext } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { invokeLambdaWorker, LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("workflow-service-api-handler", process.env.LogGroupName);
const workerInvoker = new LambdaWorkerInvoker();

async function processNotification(requestContext: McmaApiRequestContext) {
    const request = requestContext.request;

    const table = dbTableProvider.get(getTableName(requestContext), JobAssignment);

    const jobAssignmentId = getPublicUrl(requestContext) + "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentId);
    if (!jobAssignment) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    const notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    await workerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobAssignmentId,
            notification
        },
        jobAssignment.tracker,
    );
}

const restController =
    new ApiGatewayApiController(
        defaultRoutesForJobs(dbTableProvider, invokeLambdaWorker)
            .build()
            .addRoute("POST", "/job-assignments/{id}/notifications", processNotification), loggerProvider);

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
