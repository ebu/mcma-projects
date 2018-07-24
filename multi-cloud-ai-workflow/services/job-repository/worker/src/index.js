//"use strict";

const AWS = require("aws-sdk");

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const createJobProcess = async (event) => {
    let jobId = event.jobId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);
    let job = await table.get("Job", jobId);

    try {
        let jobProcess = new MCMA_CORE.JobProcess(jobId, new MCMA_CORE.NotificationEndpoint(jobId + "/notifications"));

        let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);
        jobProcess = await resourceManager.create(jobProcess);

        job.status = "QUEUED";
        job.jobProcess = jobProcess.id;
    } catch (error) {
        job.status = "FAILED";
        job.statusMessage = error.message;
    }

    await table.put("Job", jobId, job);

    await resourceManager.sendNotification(job);
}

const processNotification = async (event) => {
    let jobId = event.jobId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let job = await table.get("Job", jobId);

    job.status = notification.content.status;
    job.statusMessage = notification.content.statusMessage;

    await table.put("Job", jobId, job);

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    await resourceManager.sendNotification(job);
}

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    switch (event.action) {
        case "createJobProcess":
            await createJobProcess(event);
            break;
        case "processNotification":
            await processNotification(event);
            break;
        default:
            console.error("No handler implemented for action '" + event.action + "'.");
            break;
    }
}