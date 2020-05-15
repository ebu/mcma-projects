import { DynamoDbMutex } from "@mcma/aws-dynamodb";
import { getTableName, Job, JobProcess, JobStatus, McmaException, NotificationEndpoint } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { logJobEvent } from "../utils";

export async function createJobProcess(providers: ProviderCollection, workerRequest: WorkerRequest, context: any) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const tableName = getTableName(workerRequest);
    const table = providers.dbTableProvider.get(tableName, Job);
    const mutex = new DynamoDbMutex(jobId, context.awsRequestId, tableName, logger);

    let job: Job;

    await mutex.lock();
    try {
        job = await table.get(jobId);
        if (!job) {
            throw new McmaException("Job with id '" + jobId + "' not found");
        }

        try {
            logger.info("Creating Job Process");

            let jobProcess = new JobProcess({
                job: jobId,
                notificationEndpoint: new NotificationEndpoint({
                    httpEndpoint: jobId + "/notifications"
                }),
                tracker: job.tracker,
            });
            jobProcess = await resourceManager.create(jobProcess);

            job.status = JobStatus.Queued;
            job.jobProcess = jobProcess.id;

            logger.info("Created Job Process: " + jobProcess.id);

            await logJobEvent(logger, resourceManager, job);
        } catch (error) {
            logger.error("Failed to create JobProcess due to error '" + error?.message + "'");
            logger.error(error?.toString());
            job.status = JobStatus.Failed;
            job.statusMessage = "Failed to create JobProcess due to error '" + error?.message + "'";
        }

        job.dateModified = new Date();

        await table.put(jobId, job);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(job);
}
