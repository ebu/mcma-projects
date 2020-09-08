import { CloudWatchEvents } from "aws-sdk";
import { Job, JobAssignment, JobExecution, JobParameterBag, JobProfile, JobStatus, Logger, McmaException, NotificationEndpoint, ProblemDetail, Service } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { AuthProvider, ResourceManager, ServiceClient } from "@mcma/client";

import { DataController } from "@local/job-processor";

import { logJobEvent } from "../utils";

const cloudWatchEvents = new CloudWatchEvents();

export async function startJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { awsRequestId: string, dataController: DataController }) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const dataController = context.dataController;
    const mutex = await dataController.createMutex(jobId, context.awsRequestId);

    let job: Job;

    await mutex.lock();
    try {
        job = await dataController.getJob(jobId);
        if (!job) {
            throw new McmaException(`Job with id '${jobId}' not found`);
        }

        job = await startExecution(job, dataController, resourceManager, providers.authProvider, logger);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(job);
}

export async function startExecution(job: Job, dataController: DataController, resourceManager: ResourceManager, authProvider: AuthProvider, logger: Logger): Promise<Job> {
    logger.info("Creating Job Execution");
    let jobExecution = new JobExecution({
        status: JobStatus.Queued
    });

    jobExecution = await dataController.addExecution(job.id, jobExecution);

    job.status = jobExecution.status;
    job.error = undefined;
    job.jobOutput = new JobParameterBag();
    job.progress = undefined;
    job = await dataController.updateJob(job);

    async function failJob(error: Error) {
        jobExecution.status = JobStatus.Failed;
        jobExecution.error = new ProblemDetail({
            type: "uri://mcma.ebu.ch/rfc7807/job-processor/job-start-failure",
            title: "Failed to start job",
            detail: error?.message,
            stacktrace: error?.toString(),
        });
        await dataController.updateExecution(jobExecution);

        logger.error("Failed to start job due to error '" + error?.message + "'");
        logger.error(error?.toString());
        job.status = jobExecution.status;
        job.error = jobExecution.error;

        return await dataController.updateJob(job);
    }

    try {
        logger.info("Creating Job Assignment");

        // retrieving the jobProfile
        const jobProfile = await resourceManager.get<JobProfile>(job.jobProfile);

        // validating job.jobInput with required input parameters of jobProfile
        const jobInput = job.jobInput;
        if (!jobInput) {
            return await failJob(new McmaException("Job is missing jobInput"));
        }

        if (jobProfile.inputParameters) {
            if (!Array.isArray(jobProfile.inputParameters)) {
                return await failJob(new McmaException("JobProfile.inputParameters is not an array"));
            }

            for (const parameter of jobProfile.inputParameters) {
                if (jobInput[parameter.parameterName] === undefined) {
                    return await failJob(new McmaException("jobInput misses required input parameter '" + parameter.parameterName + "'"));
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
                serviceClient = new ServiceClient(service, authProvider);
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
                        if (serviceJobProfile === jobProfile.id) {
                            selectedService = service;
                            break;
                        }
                    }
                }
            }
            if (selectedService) {
                break;
            }
        }

        if (!jobAssignmentResourceEndpoint) {
            return await failJob(new McmaException("Failed to find service that could execute the " + job["@type"] + " with Job Profile '" + jobProfile.name + "'"));
        }

        let jobAssignment = new JobAssignment({
            job: job.id,
            notificationEndpoint: new NotificationEndpoint({
                httpEndpoint: `${jobExecution.id}/notifications`
            }),
            tracker: job.tracker
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
            return await failJob(new McmaException("Failed to post JobAssignment to Service '" + selectedService.name + "' at endpoint: " + jobAssignmentResourceEndpoint.httpEndpoint));
        }
        jobAssignment = response.data;

        logger.info(jobAssignment);

        jobExecution.status = JobStatus.Scheduled;
        jobExecution.jobAssignment = jobAssignment.id;
        jobExecution = await dataController.updateExecution(jobExecution);

        logger.info(jobExecution);

        job.status = jobExecution.status;
        job = await dataController.updateJob(job);

        await logJobEvent(logger, resourceManager, job, jobExecution);

        await cloudWatchEvents.enableRule({ Name: process.env.CloudwatchEventRule }).promise();
    } catch (error) {
        return await failJob(error);
    }

    return job;
}

