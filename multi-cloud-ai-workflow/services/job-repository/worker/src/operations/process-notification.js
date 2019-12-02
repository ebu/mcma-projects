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
    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED || job.status === JobStatus.CANCELED ||
        (job.status === JobStatus.RUNNING && notification.content.status === JobStatus.SCHEDULED)) {
        logger.warn("Ignoring update of job that tried to change state from " + job.status + " to " + notification.content.status + ": " + job.id);
        return;
    }

    if (job.status !== notification.content.status) {
        let jobProfile;
        try {
            jobProfile = await resourceManager.get(job.jobProfile);
        } catch (error) {
        }

        let jobProcess;
        try {
            // We'll ignore status change if job process already has a different status than the one
            // received in the notification as to avoid race conditions when updating the job
            jobProcess = await resourceManager.get(job.jobProcess);
            if (jobProcess.status !== notification.content.status) {
                logger.info("Ignoring JobProcess update as another update is imminent");
                return;
            }
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
            case JobStatus.RUNNING:
                logger.jobStart(msg);
                break;
            case JobStatus.FAILED:
            case JobStatus.CANCELED:
            case JobStatus.COMPLETED:
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

module.exports = {
    processNotification
};
