import * as equal from "fast-deep-equal";
import { getTableName, Job, JobAssignment, JobProcess, JobProfile, JobStatus, McmaException, NotificationEndpoint, Service } from "@mcma/core";
import { ServiceClient } from "@mcma/client";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { DynamoDbMutex } from "@mcma/aws-dynamodb";

export async function createJobAssignment(providers: ProviderCollection, workerRequest: WorkerRequest, context: any) {
    const jobProcessId = workerRequest.input.jobProcessId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const tableName = getTableName(workerRequest);
    const table = providers.dbTableProvider.get(tableName, JobProcess);
    const mutex = new DynamoDbMutex(jobProcessId, context.awsRequestId, tableName, logger);

    let jobProcess: JobProcess;

    await mutex.lock();
    try {
        jobProcess = await table.get(jobProcessId);
        if (!jobProcess) {
            throw new McmaException("JobProcess with id '" + jobProcessId + "' not found");
        }

        try {
            logger.info("Creating JobAssignment");

            // retrieving the job
            const job = await resourceManager.get<Job>(jobProcess.job);

            // retrieving the jobProfile
            const jobProfile = await resourceManager.get<JobProfile>(job.jobProfile);

            // validating job.jobInput with required input parameters of jobProfile
            const jobInput = job.jobInput;
            if (!jobInput) {
                throw new McmaException("Job is missing jobInput");
            }

            if (jobProfile.inputParameters) {
                if (!Array.isArray(jobProfile.inputParameters)) {
                    throw new McmaException("JobProfile.inputParameters is not an array");
                }

                for (const parameter of jobProfile.inputParameters) {
                    if (jobInput[parameter.parameterName] === undefined) {
                        throw new McmaException("jobInput misses required input parameter '" + parameter.parameterName + "'");
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
                    serviceClient = new ServiceClient(service, providers.authProvider);
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
                throw new McmaException("Failed to find service that could execute the " + job["@type"] + " with Job Profile '" + jobProfile.name + "'");
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
                throw new McmaException("Failed to post JobAssignment to Service '" + selectedService.name + "' at endpoint: " + jobAssignmentResourceEndpoint.httpEndpoint);
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

        jobProcess.dateModified = new Date();

        await table.put(jobProcessId, jobProcess);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(jobProcess);
}
