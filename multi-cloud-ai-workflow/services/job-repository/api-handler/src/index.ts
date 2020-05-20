import { APIGatewayEvent, Context } from "aws-lambda";
import * as AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

import { getTableName, Job, JobProfile, JobStatus, McmaTracker } from "@mcma/core";
import { DefaultRouteCollectionBuilder, getPublicUrl, getWorkerFunctionId, HttpStatusCode, McmaApiRequestContext, McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dynamoDbTableProvider = new DynamoDbTableProvider();
const lambdaWorkerInvoker = new LambdaWorkerInvoker();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-repository-api-handler", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

async function validateJob(requestContext: McmaApiRequestContext): Promise<boolean> {
    let body = requestContext.getRequestBody();
    body.status = JobStatus.New;
    if (!body.tracker) {
        let label = body["@type"];

        try {
            const resourceManager = resourceManagerProvider.get(requestContext);
            const jobProfile = await resourceManager.get<JobProfile>(body.jobProfile);
            label += " with JobProfile " + jobProfile.name;
        } catch (error) {
            requestContext.getLogger().error(error);
            label += " with unknown JobProfile";
        }

        body.tracker = new McmaTracker({ id: uuidv4(), label });
    }
    return true;
}

async function invokeCreateJobProcess(requestContext: McmaApiRequestContext, job: Job): Promise<Job> {
    await lambdaWorkerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "CreateJobProcess",
        requestContext.getAllContextVariables(),
        {
            jobId: job.id
        },
        job.tracker,
    );

    return job;
}

async function invokeDeleteJobProcess(requestContext: McmaApiRequestContext, job: Job): Promise<Job> {
    if (job.jobProcess) {
        await lambdaWorkerInvoker.invoke(
            getWorkerFunctionId(requestContext),
            "DeleteJobProcess",
            requestContext.getAllContextVariables(),
            {
                jobProcessId: job.jobProcess
            }
        );
    }
    return job;
}

async function stopJob(requestContext: McmaApiRequestContext) {
    requestContext.setResponseStatusCode(HttpStatusCode.NotImplemented, "Stopping job is not implemented");
}

async function cancelJob(requestContext: McmaApiRequestContext) {
    requestContext.setResponseStatusCode(HttpStatusCode.NotImplemented, "Canceling job is not implemented");
}

async function processNotification(requestContext: McmaApiRequestContext) {
    let table = dynamoDbTableProvider.get(getTableName(requestContext), Job);

    let job = await table.get(getPublicUrl(requestContext) + "/jobs/" + requestContext.request.pathVariables.id);
    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    if (job.jobProcess && job.jobProcess !== notification.source) {
        requestContext.response.statusCode = HttpStatusCode.BadRequest;
        requestContext.response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    await lambdaWorkerInvoker.invoke(
        getWorkerFunctionId(requestContext),
        "ProcessNotification",
        requestContext.getAllContextVariables(),
        {
            jobId: job.id,
            notification,
        },
        job.tracker,
    );
}

const routeCollection = new McmaApiRouteCollection();

const jobRoutesBuilder = new DefaultRouteCollectionBuilder(dynamoDbTableProvider, Job).addAll();
jobRoutesBuilder.route(r => r.create).configure(r => r.onStarted(validateJob).onCompleted(invokeCreateJobProcess));
jobRoutesBuilder.route(r => r.update).remove();
jobRoutesBuilder.route(r => r.delete).configure(r => r.onCompleted(invokeDeleteJobProcess));

const jobRoutes = jobRoutesBuilder.build();

routeCollection.addRoutes(jobRoutes)
               .addRoute("POST", "/jobs/{id}/stop", stopJob)
               .addRoute("POST", "/jobs/{id}/cancel", cancelJob)
               .addRoute("POST", "/jobs/{id}/notifications", processNotification);

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
        await loggerProvider.flush(Date.now() + context.getRemainingTimeInMillis() - 5000);
    }
}
