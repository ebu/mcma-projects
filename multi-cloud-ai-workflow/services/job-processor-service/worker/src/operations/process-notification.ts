//"use strict";
import { JobStatus, JobProcess, getTableName, JobAssignment } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobProcessId = workerRequest.input.jobProcessId;
    const notification = workerRequest.input.notification;

    const logger = providers.loggerProvider.get(workerRequest.tracker);
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);
    const table = providers.dbTableProvider.get(getTableName(workerRequest), JobProcess);

    let jobProcess = await table.get(jobProcessId);

    // not updating jobProcess if it already was marked as completed or failed.
    if (jobProcess.status === JobStatus.Completed ||
        jobProcess.status === JobStatus.Failed ||
        jobProcess.status === JobStatus.Canceled ||
        (jobProcess.status === JobStatus.Running && notification.content.status === JobStatus.Scheduled)) {
        logger.warn("Ignoring update of job process that tried to change state from " + jobProcess.status + " to " + notification.content.status + ": " + jobProcess.id);
        return;
    }

    if (jobProcess.status !== notification.content.status) {
        logger.info("JobProcess changed status from " + jobProcess.status + " to " + notification.content.status + ": " + jobProcess.id);

        if (notification.content.status !== JobStatus.Completed &&
            notification.content.status !== JobStatus.Failed &&
            notification.content.status !== JobStatus.Canceled) {

            try {
                // wait a bit before we fetch latest version to reduce chance of race conditions
                await sleep(1000);

                // We'll ignore status change if job assignment already has a different status than the one
                // received in the notification as to avoid race conditions when updating the job process
                const jobAssignment = typeof jobProcess.jobAssignment === "string" ? await resourceManager.get<JobAssignment>(jobProcess.jobAssignment) : jobProcess.jobAssignment;
                if (jobAssignment.status !== notification.content.status) {
                    logger.info("Ignoring JobAssignment update as another update is imminent");
                    return;
                }
            } catch (error) {
            }
        }

        switch (notification.content.status) {
            case JobStatus.Running:
                if (!jobProcess.actualStartDate) {
                    jobProcess.actualStartDate = new Date();
                }
                break;
            case JobStatus.Failed:
            case JobStatus.Canceled:
            case JobStatus.Completed:
                if (!jobProcess.actualEndDate) {
                    jobProcess.actualEndDate = new Date();
                }

                jobProcess.actualDuration = 0;

                if (jobProcess.actualStartDate && jobProcess.actualEndDate) {
                    let startDate = jobProcess.actualStartDate;
                    let endDate = jobProcess.actualEndDate;
                    if (startDate && endDate && startDate < endDate) {
                        jobProcess.actualDuration = endDate.getTime() - startDate.getTime();
                    }
                }
                break;
        }
    }

    if (jobProcess.statusMessage !== notification.content.statusMessage) {
        logger.info("JobProcess has statusMessage '" + notification.content.statusMessage + "': " + jobProcess.id);
    }

    jobProcess.status = notification.content.status;
    jobProcess.statusMessage = notification.content.statusMessage;
    jobProcess.progress = notification.content.progress;
    jobProcess.jobOutput = notification.content.jobOutput;
    jobProcess.dateModified = new Date();

    jobProcess = await table.put(jobProcessId, jobProcess);

    await resourceManager.sendNotification(jobProcess);
}

async function sleep(timeout) {
    return new Promise((resolve) => setTimeout(() => resolve(), timeout));
}