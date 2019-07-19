//"use strict";

const { Logger, JobProcess, NotificationEndpoint, JobStatus } = require("@mcma/core");

function createJobProcess(resourceManagerProvider, dbTableProvider) {
    return async function createJobProcess(workerRequest) {
        let jobId = workerRequest.input.jobId;

        let table = dbTableProvider.table(workerRequest.tableName());
        let job = await table.get(jobId);

        let resourceManager = resourceManagerProvider.get(workerRequest);

        try {
            let jobProcess = new JobProcess({
                job: jobId,
                notificationEndpoint: new NotificationEndpoint({
                    httpEndpoint: jobId + "/notifications"
                })
            });
            jobProcess = await resourceManager.create(jobProcess);

            job.status = JobStatus.queued.name;
            job.jobProcess = jobProcess.id;
        } catch (error) {
            Logger.error("Failed to create JobProcess", error);
            job.status = JobStatus.failed.name;
            job.statusMessage = "Failed to create JobProcess due to error '" + error.message + "'";
        }

        job.dateModified = new Date().toISOString();

        await table.put(jobId, job);

        await resourceManager.sendNotification(job);
    };
}

module.exports = createJobProcess;