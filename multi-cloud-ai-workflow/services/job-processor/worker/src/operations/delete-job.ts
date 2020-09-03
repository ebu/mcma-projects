import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController } from "@local/job-processor";
import { McmaException } from "@mcma/core";

export async function deleteJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { awsRequestId: string, dataController: DataController }) {
    const jobId = workerRequest.input.jobId;

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

        const executions = await dataController.getExecutions(jobId);

        for (const execution of executions.results) {
            if (execution.jobAssignment) {
                try {
                    await resourceManager.delete(execution.jobAssignment);
                } catch (error) {
                    logger.warn(`Failed to delete job assignment ${execution.jobAssignment}`);
                    logger.warn(error?.toString());
                }
            }
            await dataController.deleteExecution(execution.id);
        }

        await dataController.deleteJob(job.id);
    } finally {
        await mutex.unlock();
    }
}
