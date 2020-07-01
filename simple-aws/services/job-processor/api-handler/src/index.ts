import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";

import { HttpStatusCode, McmaApiRequestContext, McmaApiRouteCollection } from "@mcma/api";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { JobProfile, JobStatus, McmaTracker } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";

import { DataController } from "@local/job-processor";

const { TableName, PublicUrl, LogGroupName, WorkerFunctionId } = process.env;

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-api-handler", LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const dataController = new DataController(TableName, PublicUrl);

async function getJobs(requestContext: McmaApiRequestContext) {
    let status = <JobStatus>requestContext.request.queryStringParameters["status"];

    let from = new Date(requestContext.request.queryStringParameters["from"]);
    if (isNaN(from.getTime())) {
        from = undefined;
    }

    let to = new Date(requestContext.request.queryStringParameters["to"]);
    if (isNaN(to.getTime())) {
        to = undefined;
    }

    let ascending = requestContext.request.queryStringParameters["order"] === "asc";

    let limit = Number.parseInt(requestContext.request.queryStringParameters["limit"]);
    if (isNaN(limit) || limit <= 0) {
        limit = undefined;
    }

    // setting limit to default value of 100 if no other limitation is set
    if ((from === undefined || from === null) &&
        (to === undefined || to === null) &&
        (limit === undefined || limit === null)) {
        limit = 100;
    }

    const jobs = await dataController.queryJobs(status, from, to, ascending, limit);

    requestContext.setResponseBody(jobs);
}

async function addJob(requestContext: McmaApiRequestContext) {
    let job = requestContext.getRequestBody();

    job.status = JobStatus.New;
    if (!job.tracker) {
        let label = job["@type"];

        try {
            const resourceManager = resourceManagerProvider.get(requestContext);
            const jobProfile = await resourceManager.get<JobProfile>(job.jobProfile);
            label += " with JobProfile " + jobProfile.name;
        } catch (error) {
            requestContext.getLogger().error(error);
            label += " with unknown JobProfile";
        }

        job.tracker = new McmaTracker({ id: uuidv4(), label });
    }

    job = await dataController.addJob(job);

    requestContext.setResponseBody(job);

    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "StartJob",
        input: {
            jobId: job.id
        },
        contextVariables: requestContext.getAllContextVariables(),
        tracker: job.tracker,
    });
}

async function getJob(requestContext: McmaApiRequestContext) {
    const { jobId } = requestContext.request.pathVariables;

    const job = await dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    requestContext.setResponseBody(job);
}

async function deleteJob(requestContext: McmaApiRequestContext) {
    const { jobId } = requestContext.request.pathVariables;

    const job = await dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    if (job.status !== JobStatus.Completed &&
        job.status !== JobStatus.Failed &&
        job.status !== JobStatus.Canceled) {
        requestContext.setResponseStatusCode(HttpStatusCode.Conflict, `Cannot delete job while is non final state (${job.status})`);
        return;
    }

    requestContext.setResponseStatusCode(HttpStatusCode.Accepted);

    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "DeleteJob",
        input: {
            jobId: job.id
        },
        contextVariables: requestContext.getAllContextVariables(),
        tracker: job.tracker,
    });
}

async function cancelJob(requestContext: McmaApiRequestContext) {
    const { jobId } = requestContext.request.pathVariables;

    const job = await dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    if (job.status === JobStatus.Completed ||
        job.status === JobStatus.Failed ||
        job.status === JobStatus.Canceled) {
        requestContext.setResponseStatusCode(HttpStatusCode.Conflict, `Cannot cancel job when already finished`);
        return;
    }

    requestContext.setResponseStatusCode(HttpStatusCode.Accepted);

    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "CancelJob",
        input: {
            jobId: job.id
        },
        contextVariables: requestContext.getAllContextVariables(),
        tracker: job.tracker,
    });
}

async function restartJob(requestContext: McmaApiRequestContext) {
    const { jobId } = requestContext.request.pathVariables;

    const job = await dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    if (job.deadline && job.deadline < new Date()) {
        requestContext.setResponseStatusCode(HttpStatusCode.Conflict, `Cannot restart job when deadline is in the past (${job.deadline.toISOString()})`);
        return;
    }

    requestContext.setResponseStatusCode(HttpStatusCode.Accepted);

    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "RestartJob",
        input: {
            jobId: job.id
        },
        contextVariables: requestContext.getAllContextVariables(),
        tracker: job.tracker,
    });
}

async function getExecutions(requestContext: McmaApiRequestContext) {
    const { jobId } = requestContext.request.pathVariables;

    let job = await dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

    if (!job) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let status = <JobStatus>requestContext.request.queryStringParameters["status"];

    let from = new Date(requestContext.request.queryStringParameters["from"]);
    if (isNaN(from.getTime())) {
        from = undefined;
    }

    let to = new Date(requestContext.request.queryStringParameters["to"]);
    if (isNaN(to.getTime())) {
        to = undefined;
    }

    let ascending = requestContext.request.queryStringParameters["order"] === "asc";

    let limit = Number.parseInt(requestContext.request.queryStringParameters["limit"]);
    if (isNaN(limit) || limit <= 0) {
        limit = undefined;
    }

    const executions = await dataController.queryExecutions(job.id, status, from, to, ascending, limit);

    requestContext.setResponseBody(executions);
}

async function getExecution(requestContext: McmaApiRequestContext) {
    const { jobId, executionId } = requestContext.request.pathVariables;

    let execution;

    if (executionId === "latest") {
        execution = (await dataController.queryExecutions(`${PublicUrl}/jobs/${jobId}`, undefined, undefined, undefined, false, 1))[0];
    } else {
        execution = await dataController.getExecution(`${PublicUrl}/jobs/${jobId}/executions/${executionId}`);
    }

    if (!execution) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    requestContext.setResponseBody(execution);
}

async function processNotification(requestContext: McmaApiRequestContext) {
    const { jobId, executionId } = requestContext.request.pathVariables;

    let job = await dataController.getJob(`${PublicUrl}/jobs/${jobId}`);
    let jobExecution = await dataController.getExecution(`${PublicUrl}/jobs/${jobId}/executions/${executionId}`);

    if (!job || !jobExecution) {
        requestContext.setResponseResourceNotFound();
        return;
    }

    let notification = requestContext.getRequestBody();
    if (!notification) {
        requestContext.setResponseBadRequestDueToMissingBody();
        return;
    }

    if (jobExecution.jobAssignment && jobExecution.jobAssignment !== notification.source) {
        requestContext.response.statusCode = HttpStatusCode.BadRequest;
        requestContext.response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
        return;
    }

    requestContext.setResponseStatusCode(HttpStatusCode.Accepted);

    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "ProcessNotification",
        input: {
            jobId: job.id,
            jobExecutionId: jobExecution.id,
            notification,
        },
        contextVariables: requestContext.getAllContextVariables(),
        tracker: job.tracker,
    });
}

const routes = new McmaApiRouteCollection().addRoute("GET", "/jobs", getJobs)
                                           .addRoute("POST", "/jobs", addJob)
                                           .addRoute("GET", "/jobs/{jobId}", getJob)
                                           .addRoute("DELETE", "/jobs/{jobId}", deleteJob)
                                           .addRoute("POST", "/jobs/{jobId}/cancel", cancelJob)
                                           .addRoute("POST", "/jobs/{jobId}/restart", restartJob)
                                           .addRoute("GET", "/jobs/{jobId}/executions", getExecutions)
                                           .addRoute("GET", "/jobs/{jobId}/executions/{executionId}", getExecution)
                                           .addRoute("POST", "/jobs/{jobId}/executions/{executionId}/notifications", processNotification);

const restController = new ApiGatewayApiController(routes, loggerProvider);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);

        console.log("LoggerProvider.flush - START - " + new Date().toISOString());
        const t1 = Date.now();
        await loggerProvider.flush(Date.now() + context.getRemainingTimeInMillis() - 5000);
        const t2 = Date.now();
        console.log("LoggerProvider.flush - END   - " + new Date().toISOString() + " - flush took " + (t2 - t1) + " ms");
    }
}
