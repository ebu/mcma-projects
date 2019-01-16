//"use strict";

const AWS = require("aws-sdk");

const equal = require("fast-deep-equal");

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

const createJobAssignment = async (event) => {
    let resourceManager = createResourceManager(event);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobProcessId = event.jobProcessId;
    let jobProcess = await table.get("JobProcess", jobProcessId);

    try {
        // retrieving the job
        let job = await resourceManager.resolve(jobProcess.job);

        // retrieving the jobProfile
        let jobProfile = await resourceManager.resolve(job.jobProfile);

        // validating job.jobInput with required input parameters of jobProfile
        let jobInput = await resourceManager.resolve(job.jobInput);

        if (jobProfile.inputParameters) {
            if (!Array.isArray(jobProfile.inputParameters)) {
                throw new Error("JobProfile.inputParameters is not an array");
            }

            for (parameter of jobProfile.inputParameters) {
                if (jobInput[parameter.parameterName] === undefined) {
                    throw new Error("jobInput misses required input parameter '" + parameter.parameterName + "'");
                }
            }
        }

        // finding a service that is capable of handling the job type and job profile
        let services = await resourceManager.get("Service");

        let selectedService;
        let jobAssignmentResourceEndpoint;

        for (let service of services) {
            try {
                service = new MCMA_CORE.Service(service, authProvider);
            } catch (error) {
                console.warn("Failed to instantiate json " + JSON.stringify(service) + " as a Service due to error " + error.message);
            }
            jobAssignmentResourceEndpoint = null;

            if (service.jobType === job["@type"]) {
                jobAssignmentResourceEndpoint = service.getResourceEndpoint("JobAssignment");

                if (!jobAssignmentResourceEndpoint) {
                    continue;
                }

                if (service.jobProfiles) {
                    for (serviceJobProfile of service.jobProfiles) {
                        if (typeof serviceJobProfile === "string") {
                            if (serviceJobProfile === jobProfile.id) {
                                selectedService = service;
                                break;
                            }
                        } else {
                            if (equal(jobProfile, serviceJobProfile)) {
                                selectedService = service;
                                break;
                            }
                        }
                    }
                }
            }
            if (selectedService) {
                break;
            }
        }

        if (!jobAssignmentResourceEndpoint) {
            throw new Error("Failed to find service that could execute the " + job["@type"]);
        }

        let jobAssignment = new MCMA_CORE.JobAssignment({
            job: jobProcess.job,
            notificationEndpoint: new MCMA_CORE.NotificationEndpoint({
                httpEndpoint: jobProcessId + "/notifications"
            })
        });

        let response = await jobAssignmentResourceEndpoint.post(jobAssignment);
        jobAssignment = response.data;

        jobProcess.status = "SCHEDULED";
        jobProcess.jobAssignment = jobAssignment.id;
    } catch (error) {
        jobProcess.status = "FAILED";
        jobProcess.statusMessage = error.message;
    }

    jobProcess.dateModified = new Date().toISOString();

    await table.put("JobProcess", jobProcessId, jobProcess);

    await resourceManager.sendNotification(jobProcess);
}

const deleteJobAssignment = async (event) => {
    let jobAssignmentId = event.jobAssignmentId;

    try {
        let resourceManager = createResourceManager(event);
        await resourceManager.delete(jobAssignmentId);
    } catch (error) {
        console.log(error);
    }
}

const processNotification = async (event) => {
    let jobProcessId = event.jobProcessId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobProcess = await table.get("JobProcess", jobProcessId);

    // not updating jobProcess if it already was marked as completed or failed.
    if (jobProcess.status === "COMPLETED" || jobProcess.status === "FAILED") {
        console.log("Ignoring update of job process that tried to change state from " + jobProcess.status + " to " + notification.content.status)
        return;
    }

    jobProcess.status = notification.content.status;
    jobProcess.statusMessage = notification.content.statusMessage;
    jobProcess.progress = notification.content.progress;
    jobProcess.jobOutput = notification.content.jobOutput;
    jobProcess.dateModified = new Date().toISOString();

    await table.put("JobProcess", jobProcessId, jobProcess);

    let resourceManager = createResourceManager(event);

    await resourceManager.sendNotification(jobProcess);
}

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        switch (event.action) {
            case "createJobAssignment":
                await createJobAssignment(event);
                break;
            case "deleteJobAssignment":
                await deleteJobAssignment(event);
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
