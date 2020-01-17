//"use strict";

const { JobStatus } = require("@mcma/core");

async function processNotification(providers, workerRequest) {
    const jobId = workerRequest.input.jobId;
    const notification = workerRequest.input.notification;

    const table = providers.getDbTableProvider().get(workerRequest.tableName());
    const logger = providers.getLoggerProvider().get(workerRequest.tracker);
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);

    let job = await table.get(jobId);

    // not updating job if it already was marked as completed or failed.
    if (job.status === JobStatus.Completed ||
        job.status === JobStatus.Failed ||
        job.status === JobStatus.Canceled ||
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
                const jobProcess = await resourceManager.get(job.jobProcess);
                if (jobProcess.status !== notification.content.status) {
                    logger.info("Ignoring JobProcess update as another update is imminent");
                    return;
                }
            } catch (error) {
            }
        }

        let jobProfile;
        try {
            jobProfile = await resourceManager.get(job.jobProfile);
        } catch (error) {
        }

        let jobProcess;
        try {
            jobProcess = await resourceManager.get(job.jobProcess);
        } catch (error) {
        }

        const msg = {
            jobId: job.id,
            jobType: job["@type"],
            jobProfile: job.jobProfile,
            jobProfileName: jobProfile && jobProfile.name,
            jobProcess: job.jobProcess,
            jobAssignment: jobProcess && jobProcess.jobAssignment,
            jobInput: job.jobInput,
            jobStatus: notification.content.status,
            jobStatusMessage: notification.content.statusMessage,
            jobActualStartDate: jobProcess && jobProcess.actualStartDate,
            jobActualEndDate: jobProcess && jobProcess.actualEndDate,
            jobActualDuration: jobProcess && jobProcess.actualDuration,
            jobOutput: notification.content.jobOutput
        };

        switch (notification.content.status) {
            case JobStatus.Running:
                logger.jobStart(msg);
                break;
            case JobStatus.Failed:
            case JobStatus.Canceled:
            case JobStatus.Completed:
                logger.jobEnd(msg);
                break;
            default:
                logger.info(msg);
                break;
        }
    }

    job.status = notification.content.status;
    job.statusMessage = notification.content.statusMessage;
    job.progress = notification.content.progress;
    job.jobOutput = notification.content.jobOutput;
    job.dateModified = new Date().toISOString();

    job = await table.put(jobId, job);

    await resourceManager.sendNotification(job);
}

async function sleep(timeout) {
    return new Promise((resolve) => setTimeout(() => resolve(), timeout));
}

module.exports = {
    processNotification
};
