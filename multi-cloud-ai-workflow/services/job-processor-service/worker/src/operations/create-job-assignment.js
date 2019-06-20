//"use strict";

const AWS = require("aws-sdk");

const { Logger, JobProcess, Service, JobAssignment, NotificationEndpoint, JobStatus } = require("mcma-core");
const { getAwsV4ResourceManager, DynamoDbTable, getAwsV4DefaultAuthProvider } = require("mcma-aws");

const createResourceManager = getAwsV4ResourceManager.getResourceManager;

const createJobAssignment = async (event) => {
    let resourceManager = createResourceManager(event);

    let table = new DynamoDbTable(JobProcess, event.tableName());

    let jobProcessId = event.input.jobProcessId;
    let jobProcess = await table.get(jobProcessId);

    try {
        // retrieving the job
        let job = await resourceManager.resolve(jobProcess.job);

        // retrieving the jobProfile
        let jobProfile = await resourceManager.resolve(job.jobProfile);

        // validating job.jobInput with required input parameters of jobProfile
        let jobInput = job.jobInput;
        if (!jobInput) {
            throw new Exception("Job is missing jobInput");
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
        let services = await resourceManager.get(Service);

        let selectedService;
        let jobAssignmentResourceEndpoint;

        for (let service of services) {
            try {
                service = new Service(service, getAwsV4DefaultAuthProvider(AWS));
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

        let jobAssignment = new JobAssignment({
            job: jobProcess.job,
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: jobProcessId + "/notifications"
            })
        });

        let response = await jobAssignmentResourceEndpoint.post(jobAssignment);
        jobAssignment = response.data;

        jobProcess.status = JobStatus.scheduled.name;
        jobProcess.jobAssignment = jobAssignment.id;
    } catch (error) {
        Logger.error("Failed to create job assignment");
        Logger.exception(error);

        jobProcess.status = JobStatus.failed.name;
        jobProcess.statusMessage = error.message;
    }

    jobProcess.dateModified = new Date().toISOString();

    await table.put(jobProcessId, jobProcess);

    await resourceManager.sendNotification(jobProcess);
}

module.exports = createJobAssignment;