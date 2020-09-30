import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController } from "@local/job-processor";
import { JobStatus, McmaException } from "@mcma/core";
import { logJobEvent } from "../utils";

export async function failJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { awsRequestId: string, dataController: DataController }) {
    const { jobId, error } = workerRequest.input;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const dataController = context.dataController;
    const mutex = await dataController.createMutex(jobId, context.awsRequestId);

    await mutex.lock();
    try {
        const job = await dataController.getJob(jobId);
        if (!job) {
            throw new McmaException(`Job with id '${jobId}' not found`);
        }

        if (job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Canceled) {
            return;
        }

        const [jobExecution] = (await dataController.getExecutions(jobId)).results;
        if (jobExecution) {
            if (jobExecution.jobAssignmentId) {
                try {
                    const client = await resourceManager.getResourceEndpointClient(jobExecution.jobAssignmentId);
                    await client.post(undefined, `${jobExecution.jobAssignmentId}/cancel`);
                } catch (error) {
                    logger.warn(`Canceling job assignment '${jobExecution.jobAssignmentId} failed`);
                    logger.warn(error?.toString());
                }
            }
            if (!jobExecution.actualEndDate) {
                jobExecution.actualEndDate = new Date();
            }
            jobExecution.actualDuration = 0;
            if (jobExecution.actualStartDate && jobExecution.actualEndDate) {
                const startDate = jobExecution.actualStartDate.getTime();
                const endDate = jobExecution.actualEndDate.getTime();
                if (Number.isInteger(startDate) && Number.isInteger(endDate) && startDate < endDate) {
                    jobExecution.actualDuration = endDate - startDate;
                }
            }

            jobExecution.status = JobStatus.Failed;
            jobExecution.error = error;
            await dataController.updateExecution(jobExecution);
        }

        job.status = JobStatus.Failed;
        job.error = error;
        await dataController.updateJob(job);

        await logJobEvent(logger, resourceManager, job, jobExecution);
    } finally {
        await mutex.unlock();
    }
}
