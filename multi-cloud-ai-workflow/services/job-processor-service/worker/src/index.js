//"use strict";

const AWS = require("aws-sdk");

const equal = require('fast-deep-equal');

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobProcessId = event.jobProcessId;
    let jobProcess = await table.get("JobProcess", jobProcessId);

    // retrieving the job
    let job = jobProcess.job;
    if (typeof job === "string") {
        let response = await MCMA_CORE.HTTP.get(job);
        job = response.data;
    }

    // retrieving the jobProfile
    let jobProfile = job.jobProfile;
    if (typeof jobProfile === "string") {
        let response = await MCMA_CORE.HTTP.get(jobProfile);
        jobProfile = response.data;
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

    let jobAssignment = new MCMA_CORE.JobAssignment(jobProcess.job);

    let response = await MCMA_CORE.HTTP.post(jobAssignmentEndPoint, jobAssignment);
    jobAssignment = response.data;

    jobProcess.status = "SCHEDULED";
    jobProcess.jobAssignment = jobAssignment.id;

    await table.put("JobProcess", jobProcessId, jobProcess);
}
