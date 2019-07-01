//"use strict";

const { Job, JobProcess, NotificationEndpoint, JobStatus } = require("mcma-core");
const { getAwsV4ResourceManager, DynamoDbTable } = require("mcma-aws");

const createJobProcess = async (workerRequest) => {
    let jobId = workerRequest.input.jobId;

    let table = new DynamoDbTable(Job, workerRequest.tableName());
    let job = await table.get(jobId);

    let resourceManager = getAwsV4ResourceManager(workerRequest);

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
        job.status = JobStatus.failed.name;
        job.statusMessage = "Failed to create JobProcess due to error '" + error.message + "'";
    }

    job.dateModified = new Date().toISOString();

    await table.put(jobId, job);

    await resourceManager.sendNotification(job);
}

module.exports = createJobProcess;