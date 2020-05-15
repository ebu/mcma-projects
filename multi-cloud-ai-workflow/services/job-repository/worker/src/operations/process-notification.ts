import { DynamoDbMutex } from "@mcma/aws-dynamodb";
import { getTableName, Job, JobStatus, McmaException } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { logJobEvent } from "../utils";

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest, context) {
    const jobId = workerRequest.input.jobId;
    const notification = workerRequest.input.notification;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const tableName = getTableName(workerRequest);
    const table = providers.dbTableProvider.get(tableName, Job);
    const mutex = new DynamoDbMutex(jobId, context.awsRequestId, tableName, logger);

    let job: Job;

    await mutex.lock();
    try {
        job = await table.get(jobId);
        job = new Job(job["@type"], job);
        if (!job) {
            throw new McmaException("Job with id '" + jobId + "' not found");
        }

        // not updating job if it already was marked as completed or failed.
        if (job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Canceled ||
            (job.status === JobStatus.Running && notification.content.status === JobStatus.Scheduled)) {
            logger.warn("Ignoring notification for job that would change state from " + job.status + " to " + notification.content.status + ": " + job.id);
            return;
        }

        job.status = notification.content.status;
        job.statusMessage = notification.content.statusMessage;
        job.progress = notification.content.progress;
        job.jobOutput = notification.content.jobOutput;
        job.dateModified = new Date();

        job = await table.put(jobId, job);
    } finally {
        await mutex.unlock();
    }

    await logJobEvent(logger, resourceManager, job);

    await resourceManager.sendNotification(job);
}
