//"use strict";

const AWS = require("aws-sdk");

const { Job, JobStatus } = require("mcma-core");
const { getAwsV4ResourceManager, DynamoDbTable } = require("mcma-aws");

const createResourceManager = getAwsV4ResourceManager.getResourceManager;

const processNotification = async (event) => {
    let jobId = event.input.jobId;
    let notification = event.input.notification;

    let table = new DynamoDbTable(Job, event.tableName());

    let job = await table.get(jobId);

    // not updating job if it already was marked as completed or failed.
    if (JobStatus.completed.equals(job.status) || JobStatus.failed.equals(job.status)) {
        console.log("Ignoring update of job that tried to change state from " + job.status + " to " + notification.content.status)
        return;
    }

    job.status = notification.content.status;
    job.statusMessage = notification.content.statusMessage;
    job.progress = notification.content.progress;
    job.jobOutput = notification.content.jobOutput;
    job.dateModified = new Date().toISOString();

    await table.put(jobId, job);

    let resourceManager = createResourceManager(event);

    await resourceManager.sendNotification(job);
}

module.exports = processNotification;