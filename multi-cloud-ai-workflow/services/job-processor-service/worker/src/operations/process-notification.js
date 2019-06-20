//"use strict";

const AWS = require("aws-sdk");

const { JobProcess, JobStatus } = require("mcma-core");
const { getAwsV4ResourceManager, DynamoDbTable } = require("mcma-aws");

const createResourceManager = getAwsV4ResourceManager.getResourceManager;


const processNotification = async (event) => {
    let jobProcessId = event.jobProcessId;
    let notification = event.notification;

    let table = new DynamoDbTable(JobProcess, event.tableName());

    let jobProcess = await table.get(jobProcessId);

    // not updating jobProcess if it already was marked as completed or failed.
    if (JobStatus.completed.equals(jobProcess.status) || JobStatus.failed.equals(jobProcess.status)) {
        console.log("Ignoring update of job process that tried to change state from " + jobProcess.status + " to " + notification.content.status)
        return;
    }

    jobProcess.status = notification.content.status;
    jobProcess.statusMessage = notification.content.statusMessage;
    jobProcess.progress = notification.content.progress;
    jobProcess.jobOutput = notification.content.jobOutput;
    jobProcess.dateModified = new Date().toISOString();

    await table.put(jobProcessId, jobProcess);

    let resourceManager = createResourceManager(event);

    await resourceManager.sendNotification(jobProcess);
}

module.exports = processNotification;