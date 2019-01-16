//"use strict";

const AWS = require("aws-sdk");

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
});

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const createResourceManager = (event) => {
    return new MCMA_CORE.ResourceManager({
        servicesUrl: event.request.stageVariables.ServicesUrl,
        servicesAuthType: event.request.stageVariables.ServicesAuthType,
        servicesAuthContext: event.request.stageVariables.ServicesAuthContext,
        authProvider
    });
}

const createJobProcess = async (event) => {
    let jobId = event.jobId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);
    let job = await table.get("Job", jobId);

    let resourceManager = createResourceManager(event);

    try {
        let jobProcess = new MCMA_CORE.JobProcess({
            job: jobId,
            notificationEndpoint: new MCMA_CORE.NotificationEndpoint({
                httpEndpoint: jobId + "/notifications"
            })
        });
        jobProcess = await resourceManager.create(jobProcess);

        job.status = "QUEUED";
        job.jobProcess = jobProcess.id;
    } catch (error) {
        job.status = "FAILED";
        job.statusMessage = "Failed to create JobProcess due to error '" + error.message + "'";
    }

    job.dateModified = new Date().toISOString();

    await table.put("Job", jobId, job);

    await resourceManager.sendNotification(job);
}

const deleteJobProcess = async (event) => {
    let jobProcessId = event.jobProcessId;

    try {
        let resourceManager = createResourceManager(event);
        await resourceManager.delete(jobProcessId);
    } catch (error) {
        console.log(error);
    }
}

const processNotification = async (event) => {
    let jobId = event.jobId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let job = await table.get("Job", jobId);

    // not updating job if it already was marked as completed or failed.
    if (job.status === "COMPLETED" || job.status === "FAILED") {
        console.log("Ignoring update of job that tried to change state from " + job.status + " to " + notification.content.status)
        return;
    }

    job.status = notification.content.status;
    job.statusMessage = notification.content.statusMessage;
    job.progress = notification.content.progress;
    job.jobOutput = notification.content.jobOutput;
    job.dateModified = new Date().toISOString();

    await table.put("Job", jobId, job);

    let resourceManager = createResourceManager(event);

    await resourceManager.sendNotification(job);
}

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        switch (event.action) {
            case "createJobProcess":
                await createJobProcess(event);
                break;
            case "deleteJobProcess":
                await deleteJobProcess(event);
                break;
            case "processNotification":
                await processNotification(event);
                break;
            default:
                console.error("No handler implemented for action '" + event.action + "'.");
                break;
        }
    } catch (error) {
        console.log("Error occurred when handling action '" + event.action + "'")
        console.log(error.toString());
    }
}