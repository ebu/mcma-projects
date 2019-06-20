//"use strict";

const AWS = require("aws-sdk");

const { Job, JobProcess, NotificationEndpoint, JobStatus } = require("mcma-core");
const { getAwsV4ResourceManager, DynamoDbTable } = require("mcma-aws");

const createResourceManager = getAwsV4ResourceManager.getResourceManager;

const createJobProcess = async (event) => {
    let jobId = event.input.jobId;

    let table = new DynamoDbTable(Job, event.tableName());
    let job = await table.get(jobId);

    let resourceManager = createResourceManager(event);

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