import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController } from "@local/job-processor";
import { DynamoDbMutex } from "@mcma/aws-dynamodb";
import { Job, JobStatus, Logger, McmaException } from "@mcma/core";
import { logJobEvent } from "../utils";
import { AuthProvider, ResourceManager } from "@mcma/client";

export async function cancelJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { awsRequestId: string, dataController: DataController }) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const dataController = context.dataController;
    const mutex = new DynamoDbMutex(jobId, context.awsRequestId, dataController.tableName, logger);

    let job: Job;

    await mutex.lock();
    try {
        job = await dataController.getJob(jobId);
        if (!job) {
            throw new McmaException(`Job with id '${jobId}' not found`);
        }

        job = await cancelExecution(job, dataController, resourceManager, providers.authProvider, logger);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(job);
}

export async function cancelExecution(job: Job, dataController: DataController, resourceManager: ResourceManager, authProvider: AuthProvider, logger: Logger): Promise<Job> {
    if (job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Canceled) {
        return job;
    }

    const [jobExecution] = await dataController.getExecutions(job.id);

    if (jobExecution.jobAssignment) {
        try {
            const client = await resourceManager.getResourceEndpointClient(jobExecution.jobAssignment);
            await client.post(undefined, `${jobExecution.jobAssignment}/cancel`);
        } catch (error) {
            logger.warn(`Canceling job assignment '${jobExecution.jobAssignment} failed`);
            logger.warn(error?.toString());
        }
    }

    jobExecution.status = JobStatus.Canceled;
    await dataController.updateExecution(jobExecution);

    job.status = JobStatus.Canceled;
    await dataController.updateJob(job);

    await logJobEvent(logger, resourceManager, job, jobExecution);

    return job;
}
