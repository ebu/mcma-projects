import { v4 as uuidv4 } from "uuid";
import { HttpStatusCode, McmaApiRequestContext, McmaApiRouteCollection, } from "@mcma/api";
import { JobProfile, JobStatus, McmaTracker } from "@mcma/core";
import { ResourceManagerProvider } from "@mcma/client";
import { WorkerInvoker } from "@mcma/worker-invoker";

import { DataController } from "@local/job-processor";
import { buildQueryParameters } from "./queries";

const { PublicUrl, WorkerFunctionId } = process.env;

export class JobRoutes extends McmaApiRouteCollection {
    constructor(private dataController: DataController, private resourceManagerProvider: ResourceManagerProvider, private workerInvoker: WorkerInvoker) {
        super();

        this.addRoute("GET", "/jobs", reqCtx => this.queryJobs(reqCtx));
        this.addRoute("POST", "/jobs", reqCtx => this.addJob(reqCtx));
        this.addRoute("GET", "/jobs/{jobId}", reqCtx => this.getJob(reqCtx));
        this.addRoute("DELETE", "/jobs/{jobId}", reqCtx => this.deleteJob(reqCtx));
        this.addRoute("POST", "/jobs/{jobId}/cancel", reqCtx => this.cancelJob(reqCtx));
        this.addRoute("POST", "/jobs/{jobId}/restart", reqCtx => this.restartJob(reqCtx));
    }

    async queryJobs(requestContext: McmaApiRequestContext) {
        const queryStringParameters = requestContext.request.queryStringParameters;
        const queryParameters = buildQueryParameters(queryStringParameters, 100);

        const jobs = await this.dataController.queryJobs(queryParameters, queryStringParameters.pageStartToken);

        requestContext.setResponseBody(jobs);
    }

    async addJob(requestContext: McmaApiRequestContext) {
        let job = requestContext.getRequestBody();

        job.status = JobStatus.New;
        if (!job.tracker) {
            let label = job["@type"];

            try {
                const resourceManager = this.resourceManagerProvider.get(requestContext);
                const jobProfile = await resourceManager.get<JobProfile>(job.jobProfile);
                label += " with JobProfile " + jobProfile.name;
            } catch (error) {
                requestContext.getLogger().error(error);
                label += " with unknown JobProfile";
            }

            job.tracker = new McmaTracker({ id: uuidv4(), label });
        }

        job = await this.dataController.addJob(job);

        requestContext.setResponseBody(job);

        await this.workerInvoker.invoke(WorkerFunctionId, {
            operationName: "StartJob",
            input: {
                jobId: job.id
            },
            contextVariables: requestContext.getAllContextVariables(),
            tracker: job.tracker,
        });
    }

    async getJob(requestContext: McmaApiRequestContext) {
        const { jobId } = requestContext.request.pathVariables;

        const job = await this.dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

        if (!job) {
            requestContext.setResponseResourceNotFound();
            return;
        }

        requestContext.setResponseBody(job);
    }

    async deleteJob(requestContext: McmaApiRequestContext) {
        const { jobId } = requestContext.request.pathVariables;

        const job = await this.dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

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

        await this.workerInvoker.invoke(WorkerFunctionId, {
            operationName: "DeleteJob",
            input: {
                jobId: job.id
            },
            contextVariables: requestContext.getAllContextVariables(),
            tracker: job.tracker,
        });
    }

    async cancelJob(requestContext: McmaApiRequestContext) {
        const { jobId } = requestContext.request.pathVariables;

        const job = await this.dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

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

        await this.workerInvoker.invoke(WorkerFunctionId, {
            operationName: "CancelJob",
            input: {
                jobId: job.id
            },
            contextVariables: requestContext.getAllContextVariables(),
            tracker: job.tracker,
        });
    }

    async restartJob(requestContext: McmaApiRequestContext) {
        const { jobId } = requestContext.request.pathVariables;

        const job = await this.dataController.getJob(`${PublicUrl}/jobs/${jobId}`);

        if (!job) {
            requestContext.setResponseResourceNotFound();
            return;
        }

        if (job.deadline && job.deadline < new Date()) {
            requestContext.setResponseStatusCode(HttpStatusCode.Conflict, `Cannot restart job when deadline is in the past (${job.deadline.toISOString()})`);
            return;
        }

        requestContext.setResponseStatusCode(HttpStatusCode.Accepted);

        await this.workerInvoker.invoke(WorkerFunctionId, {
            operationName: "RestartJob",
            input: {
                jobId: job.id
            },
            contextVariables: requestContext.getAllContextVariables(),
            tracker: job.tracker,
        });
    }
}