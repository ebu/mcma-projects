//"use strict";

import { Job, JobStatus } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { DynamoDbTable } from "@mcma/aws-dynamodb";

import { logJobEvent } from "../utils";

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobId = workerRequest.input.jobId;
    const notification = workerRequest.input.notification;

    const table = new DynamoDbTable(workerRequest.tableName(), Job);
    const logger = providers.getLoggerProvider().get(workerRequest.tracker);
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);

    let job = await table.get(jobId);

    // not updating job if it already was marked as completed or failed.
    if (job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Canceled ||
        (job.status === JobStatus.Running && notification.content.status === JobStatus.Scheduled)) {
        logger.warn("Ignoring update of job that tried to change state from " + job.status + " to " + notification.content.status + ": " + job.id);
        return;
    }

    if (job.status !== notification.content.status) {

        // in case are not in a final state check if we have a newer version available, to avoid race conditions
        if (notification.content.status !== JobStatus.Completed &&
            notification.content.status !== JobStatus.Failed &&
            notification.content.status !== JobStatus.Canceled) {

            try {
                // wait a bit before we fetch latest version to reduce chance of race conditions
                await sleep(1000);
                // We'll ignore status change if job assignment already has a different status than the one
                // received in the notification as to avoid race conditions when updating the job process

                // @ts-ignore TODO remove ignore when library supports it.
                const jobProcess = await resourceManager.get(job.jobProcess);
                if (jobProcess.status !== notification.content.status) {
                    logger.info("Ignoring JobProcess update as another update is imminent");
                    return;
                }
            } catch (error) {
            }
        }
    }

    job.status = notification.content.status;
    job.statusMessage = notification.content.statusMessage;
    job.progress = notification.content.progress;
    job.jobOutput = notification.content.jobOutput;
    job.dateModified = new Date().toISOString();

    job = await table.put(jobId, job);

    await logJobEvent(logger, resourceManager, job);

    await resourceManager.sendNotification(job);
}

async function sleep(timeout) {
    return new Promise((resolve) => setTimeout(() => resolve(), timeout));
}
