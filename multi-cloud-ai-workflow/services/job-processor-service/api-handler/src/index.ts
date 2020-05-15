import { v4 as uuidv4 } from "uuid";
import { APIGatewayEvent, Context } from "aws-lambda";
import { getTableName, JobProcess, McmaTracker } from "@mcma/core";
import { DefaultRouteCollectionBuilder, getPublicUrl, getWorkerFunctionId, HttpStatusCode, McmaApiRequestContext, McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTable, DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";

const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-service-api-handler", process.env.LogGroupName);
const workerInvoker = new LambdaWorkerInvoker();

async function validateJobProcess(requestContext: McmaApiRequestContext): Promise<boolean> {
    let body = requestContext.getRequestBody();
    if (!body.tracker) {
        body.tracker = new McmaTracker({ id: uuidv4(), label: body["@type"] });
    }
    return true;
}

async function invokeCreateJobAssignment(requestContext: McmaApiRequestContext, jobProcess: JobProcess): Promise<JobProcess> {
    await workerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "CreateJobAssignment",
        requestContext.getAllContextVariables(),
        {
            jobProcessId: jobProcess.id
        },
        jobProcess.tracker,
    );

    return jobProcess;
}

async function invokeDeleteJobAssignment(requestContext: McmaApiRequestContext, jobProcess: JobProcess): Promise<JobProcess> {
    await workerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "DeleteJobAssignment",
        requestContext.getAllContextVariables(),
        {
            jobAssignmentId: jobProcess.jobAssignment
        },
        jobProcess.tracker,
    );
    return jobProcess;
}

async function processNotification(requestContext: McmaApiRequestContext) {
    let table = new DynamoDbTable(getTableName(requestContext), JobProcess);

    let jobProcessId = getPublicUrl(requestContext) + "/job-processes/" + requestContext.request.pathVariables.id;

    let jobProcess = await table.get(jobProcessId);
    if (!jobProcess) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    if (jobProcess.jobAssignment && jobProcess.jobAssignment !== notification.source) {
        requestContext.response.statusCode = HttpStatusCode.BadRequest;
        requestContext.response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    // invoking worker lambda function that will process the notification
    await workerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobProcessId,
            notification
        },
        jobProcess.tracker,
    );
}

const routeCollection = new McmaApiRouteCollection();

const jobProcessRouteBuilder = new DefaultRouteCollectionBuilder(dbTableProvider, JobProcess).addAll();
jobProcessRouteBuilder.route(r => r.create).configure(r => r.onStarted(validateJobProcess).onCompleted(invokeCreateJobAssignment));
jobProcessRouteBuilder.route(r => r.update).remove();
jobProcessRouteBuilder.route(r => r.delete).configure(r => r.onCompleted(invokeDeleteJobAssignment));

const jobProcessRoutes = jobProcessRouteBuilder.build();

routeCollection.addRoutes(jobProcessRoutes);
routeCollection.addRoute("POST", "/job-processes/{id}/notifications", processNotification);

const restController = new ApiGatewayApiController(routeCollection, loggerProvider);

export async function handler(event: APIGatewayEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
