//"use strict";
const { JobStatus } = require("@mcma/core");

async function processNotification(providers, workerRequest) {
    const jobProcessId = workerRequest.input.jobProcessId;
    const notification = workerRequest.input.notification;

    const logger = providers.getLoggerProvider().get(workerRequest.tracker);
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);
    const table = providers.getDbTableProvider().get(workerRequest.tableName());

    let jobProcess = await table.get(jobProcessId);

    // not updating jobProcess if it already was marked as completed or failed.
    if (jobProcess.status === JobStatus.COMPLETED || jobProcess.status === JobStatus.FAILED || jobProcess.status === JobStatus.CANCELED ||
        (jobProcess.status === JobStatus.RUNNING && notification.content.status === JobStatus.SCHEDULED)) {
        logger.warn("Ignoring update of job process that tried to change state from " + jobProcess.status + " to " + notification.content.status + ": " + jobProcess.id);
        return;
    }

    if (jobProcess.status !== notification.content.status) {
        logger.info("JobProcess changed status from " + jobProcess.status + " to " + notification.content.status + ": " + jobProcess.id);

        try {
            // We'll ignore status change if job assignment already has a different status than the one
            // received in the notification as to avoid race conditions when updating the job process
            const jobAssignment = await resourceManager.get(jobProcess.jobAssignment);
            if (jobAssignment.status !== notification.content.status) {
                logger.info("Ignoring JobAssignment update as another update is imminent");
                return;
            }
        } catch (error) {
        }

        switch (notification.content.status) {
            case JobStatus.RUNNING:
                if (!jobProcess.actualStartDate) {
                    jobProcess.actualStartDate = new Date().toISOString();
                }
                break;
            case JobStatus.FAILED:
            case JobStatus.CANCELED:
            case JobStatus.COMPLETED:
                if (!jobProcess.actualEndDate) {
                    jobProcess.actualEndDate = new Date().toISOString();
                }

                jobProcess.actualDuration = 0;

                if (jobProcess.actualStartDate && jobProcess.actualEndDate) {
                    let startDate = Date.parse(jobProcess.actualStartDate);
                    let endDate = Date.parse(jobProcess.actualEndDate);
                    if (Number.isInteger(startDate) && Number.isInteger(endDate) && startDate < endDate) {
                        jobProcess.actualDuration = endDate - startDate;
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
    jobProcess.dateModified = new Date().toISOString();

    jobProcess = await table.put(jobProcessId, jobProcess);

    await resourceManager.sendNotification(jobProcess);
}

module.exports = {
    processNotification
};
