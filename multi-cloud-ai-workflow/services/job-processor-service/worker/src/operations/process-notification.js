//"use strict";
const { JobStatus } = require("@mcma/core");

function processNotification(resourceManagerProvider, dbTableProvider) {
    return async function processNotification(event) {
        let jobProcessId = event.input.jobProcessId;
        let notification = event.input.notification;

        let table = dbTableProvider.table(event.tableName());

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

        let resourceManager = resourceManagerProvider.get(event);

        await resourceManager.sendNotification(jobProcess);
    };
}

module.exports = processNotification;