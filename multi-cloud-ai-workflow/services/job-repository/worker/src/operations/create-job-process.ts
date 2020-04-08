//"use strict";

import { Job, JobProcess, JobStatus, NotificationEndpoint, getTableName } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { DynamoDbTable } from "@mcma/aws-dynamodb";

import { logJobEvent } from "../utils";

export async function createJobProcess(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobId = workerRequest.input.jobId;

    const table = new DynamoDbTable(getTableName(workerRequest), Job);
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);
    const logger = providers.loggerProvider.get(workerRequest.tracker);

    const job = await table.get(jobId);

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
        // @ts-ignore TODO remove ignore when library supports it.
        job.jobProcess = jobProcess.id;

        logger.info("Created Job Process: " + jobProcess.id);

        await logJobEvent(logger, resourceManager, job);
    } catch (error) {
        logger.error("Failed to create JobProcess", error);
        job.status = JobStatus.Failed;
        job.statusMessage = "Failed to create JobProcess due to error '" + error.message + "'";
    }

    job.dateModified = new Date();

    await table.put(jobId, job);

    await resourceManager.sendNotification(job);
}

