//"use strict";

const equal = require("fast-deep-equal");

const { Service, JobAssignment, NotificationEndpoint, JobStatus, Exception } = require("@mcma/core");
const { ServiceClient } = require("@mcma/client");

async function createJobAssignment(providers, workerRequest) {
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);
    const table = providers.getDbTableProvider().get(workerRequest.tableName());
    const logger = providers.getLoggerProvider().get(workerRequest.tracker);

    const jobProcessId = workerRequest.input.jobProcessId;
    const jobProcess = await table.get(jobProcessId);

    try {
        logger.info("Creating JobAssignment");

        // retrieving the job
        const job = await resourceManager.get(jobProcess.job);

        // retrieving the jobProfile
        const jobProfile = await resourceManager.get(job.jobProfile);

        // validating job.jobInput with required input parameters of jobProfile
        const jobInput = job.jobInput;
        if (!jobInput) {
            throw new Exception("Job is missing jobInput");
        }

        if (jobProfile.inputParameters) {
            if (!Array.isArray(jobProfile.inputParameters)) {
                throw new Exception("JobProfile.inputParameters is not an array");
            }

            for (const parameter of jobProfile.inputParameters) {
                if (jobInput[parameter.parameterName] === undefined) {
                    throw new Exception("jobInput misses required input parameter '" + parameter.parameterName + "'");
                }
            }
        }

        // finding a service that is capable of handling the job type and job profile
        const services = await resourceManager.query(Service);

        let selectedService;
        let jobAssignmentResourceEndpoint;

        for (const service of services) {
            let serviceClient;
            try {
                serviceClient = new ServiceClient(service, providers.getAuthProvider());
            } catch (error) {
                logger.warn("Failed to instantiate json as a Service due to error " + error.message);
                logger.warn(service);
                continue;
            }
            jobAssignmentResourceEndpoint = null;

            if (service.jobType === job["@type"]) {
                jobAssignmentResourceEndpoint = serviceClient.getResourceEndpointClient(JobAssignment);

                if (!jobAssignmentResourceEndpoint) {
                    continue;
                }

                if (service.jobProfiles) {
                    for (let serviceJobProfile of service.jobProfiles) {
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
            throw new Exception("Failed to find service that could execute the " + job["@type"] + " with Job Profile '" + jobProfile.name + "'");
        }

        let jobAssignment = new JobAssignment({
            job: jobProcess.job,
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: jobProcessId + "/notifications"
            }),
            tracker: jobProcess.tracker,
        });

        let response;
        try {
            response = await jobAssignmentResourceEndpoint.post(jobAssignment);
        } catch (error) {
            if (error.response) {
                logger.error(error.response.data);
                logger.error(error.response.status);
                logger.error(error.response.headers);
            } else if (error.request) {
                logger.error(error.request + "");
            } else {
                // Something happened in setting up the request that triggered an Error
                logger.error(error.message);
            }
            throw new Exception("Failed to post JobAssignment to Service '" + selectedService.name + "' at endpoint: " + jobAssignmentResourceEndpoint.httpEndpoint);
        }
        jobAssignment = response.data;

        jobProcess.status = JobStatus.Scheduled;
        jobProcess.jobAssignment = jobAssignment.id;

        logger.info("Created JobAssignment: " + jobAssignment.id);
    } catch (error) {
        logger.error("Failed to create job assignment");
        logger.error(error.toString());

        jobProcess.status = JobStatus.Failed;
        jobProcess.statusMessage = error.message;
    }

    jobProcess.dateModified = new Date().toISOString();

    await table.put(jobProcessId, jobProcess);

    await resourceManager.sendNotification(jobProcess);
}

module.exports = {
    createJobAssignment
};
