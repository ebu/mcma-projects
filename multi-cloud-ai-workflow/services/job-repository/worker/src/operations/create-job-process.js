//"use strict";

const { JobProcess, NotificationEndpoint, JobStatus } = require("@mcma/core");

async function createJobProcess(providers, workerRequest) {
    const jobId = workerRequest.input.jobId;

    const table = providers.getDbTableProvider().get(workerRequest.tableName());
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);
    const logger = providers.getLoggerProvider().get(workerRequest.tracker);

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
        job.jobProcess = jobProcess.id;

        logger.info("Created Job Process: " + jobProcess.id);
    } catch (error) {
        logger.error("Failed to create JobProcess", error);
        job.status = JobStatus.Failed;
        job.statusMessage = "Failed to create JobProcess due to error '" + error.message + "'";
    }

    job.dateModified = new Date().toISOString();

    await table.put(jobId, job);

    await resourceManager.sendNotification(job);
}

module.exports = {
    createJobProcess
};
