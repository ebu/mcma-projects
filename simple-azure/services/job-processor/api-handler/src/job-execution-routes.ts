import { HttpStatusCode, McmaApiRequestContext, McmaApiRouteCollection } from "@mcma/api";
import { invokeQueueTriggeredWorker } from "@mcma/azure-queue-worker-invoker";

import { DataController } from "@local/job-processor";
import { buildQueryParameters } from "./queries";

const { PublicUrl, WorkerFunctionId } = process.env;

export class JobExecutionRoutes extends McmaApiRouteCollection {
    constructor(private dataController: DataController) {
        super();

        this.addRoute("GET", "/jobs/{jobId}/executions", reqCtx => this.queryExecutions(reqCtx));
        this.addRoute("GET", "/jobs/{jobId}/executions/{executionId}", reqCtx => this.getExecution(reqCtx));
        this.addRoute("POST", "/jobs/{jobId}/executions/{executionId}/notifications", reqCtx => this.processNotification(reqCtx));
    }

    async queryExecutions(requestContext: McmaApiRequestContext) {
        const { jobId } = requestContext.request.pathVariables;

        let job = await this.dataController.getJob(`${PublicUrl}/jobs/${jobId}`);
        if (!job) {
            requestContext.setResponseResourceNotFound();
            return;
        }

        const queryStringParameters = requestContext.request.queryStringParameters;
        const queryParameters = buildQueryParameters(queryStringParameters);

        const executions = await this.dataController.queryExecutions(job.id, queryParameters, queryStringParameters.pageStartToken);

        requestContext.setResponseBody(executions);
    }

    async getExecution(requestContext: McmaApiRequestContext) {
        const { jobId, executionId } = requestContext.request.pathVariables;

        let execution;

        if (executionId === "latest") {
            execution = (await this.dataController.queryExecutions(`${PublicUrl}/jobs/${jobId}`, { limit: 1 }))[0];
        } else {
            execution = await this.dataController.getExecution(`${PublicUrl}/jobs/${jobId}/executions/${executionId}`);
        }

        if (!execution) {
            requestContext.setResponseResourceNotFound();
            return;
        }

        requestContext.setResponseBody(execution);
    }

    async processNotification(requestContext: McmaApiRequestContext) {
        const { jobId, executionId } = requestContext.request.pathVariables;

        let job = await this.dataController.getJob(`${PublicUrl}/jobs/${jobId}`);
        let jobExecution = await this.dataController.getExecution(`${PublicUrl}/jobs/${jobId}/executions/${executionId}`);

        if (!job || !jobExecution) {
            requestContext.setResponseResourceNotFound();
            return;
        }

        let notification = requestContext.getRequestBody();
        if (!notification) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return;
        }

        if (jobExecution.jobAssignmentId && jobExecution.jobAssignmentId !== notification.source) {
            requestContext.response.statusCode = HttpStatusCode.BadRequest;
            requestContext.response.statusMessage = "Unexpected notification from '" + notification.source + "'.";
            return;
        }

        requestContext.setResponseStatusCode(HttpStatusCode.Accepted);

        await invokeQueueTriggeredWorker(WorkerFunctionId, {
            operationName: "ProcessNotification",
            input: {
                jobId: job.id,
                jobExecutionId: jobExecution.id,
                notification,
            },
            tracker: job.tracker,
        });
    }
}