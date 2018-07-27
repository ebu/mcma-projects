//"use strict";

const AWS = require("aws-sdk");

const equal = require("fast-deep-equal");

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const createJobAssignment = async (event) => {
    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobProcessId = event.jobProcessId;
    let jobProcess = await table.get("JobProcess", jobProcessId);

    try {
        // retrieving the job
        let job = jobProcess.job;
        if (typeof job === "string") {
            try {
                let response = await MCMA_CORE.HTTP.get(job);
                job = response.data;
            } catch (error) {
                throw new Error("Failed to retrieve job definition from url '" + job + "'")
            }
        }
        if (!job) {
            throw new Error("JobProcess is missing a job definition")
        }

        // retrieving the jobProfile
        let jobProfile = job.jobProfile;
        if (typeof jobProfile === "string") {
            try {
                let response = await MCMA_CORE.HTTP.get(jobProfile);
                jobProfile = response.data;
            } catch (error) {
                throw new Error("Failed to retrieve job profile from url '" + jobProfile + "'")
            }
        }
        if (!jobProfile) {
            throw new Error("Job is missing jobProfile");
        }

        // validating job.jobInput with required input parameters of jobProfile
        let jobInput = job.jobInput;
        if (typeof jobInput === "string") {
            try {
                let response = await MCMA_CORE.HTTP.get(jobInput);
                jobInput = response.data;
            } catch (error) {
                throw new Error("Failed to retrieve job input from url '" + jobInput + "'")
            }
        }
        if (!jobInput) {
            throw new Error("Job is missing jobInput");
        }

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
        let jobAssignmentEndPoint;

        for (service of services) {
            jobAssignmentEndPoint = null;

            if (service.jobType === job["@type"]) {
                if (service.resources) {
                    for (serviceResource of service.resources) {
                        if (serviceResource.resourceType === "JobAssignment") {
                            jobAssignmentEndPoint = serviceResource.httpEndpoint;
                        }
                    }
                }

                if (!jobAssignmentEndPoint) {
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

        if (!jobAssignmentEndPoint) {
            throw new Error("Failed to find service that could execute the " + job["@type"]);
        }

        let jobAssignment = new MCMA_CORE.JobAssignment(jobProcess.job, new MCMA_CORE.NotificationEndpoint(jobProcessId + "/notifications"));
        let response = await MCMA_CORE.HTTP.post(jobAssignmentEndPoint, jobAssignment);
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

const processNotification = async (event) => {
    let jobProcessId = event.jobProcessId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobProcess = await table.get("JobProcess", jobProcessId);

    jobProcess.status = notification.content.status;
    jobProcess.statusMessage = notification.content.statusMessage;
    jobProcess.jobOutput = notification.content.jobOutput;
    jobProcess.dateModified = new Date().toISOString();

    await table.put("JobProcess", jobProcessId, jobProcess);

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    await resourceManager.sendNotification(jobProcess);
}

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    switch (event.action) {
        case "createJobAssignment":
            await createJobAssignment(event);
            break;
        case "processNotification":
            await processNotification(event);
            break;
        default:
            console.error("No handler implemented for action '" + event.action + "'.");
            break;
    }
}
