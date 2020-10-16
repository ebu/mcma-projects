import { McmaException } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController } from "@local/job-processor";

export async function deleteJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { eventId: string, dataController: DataController }) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(providers.contextVariableProvider);

    const dataController = context.dataController;
    const mutex = await dataController.createMutex(jobId, context.eventId);

    await mutex.lock();
    try {
        const job = await dataController.getJob(jobId);
        if (!job) {
            throw new McmaException(`Job with id '${jobId}' not found`);
        }

        const executions = await dataController.getExecutions(jobId);

        for (const execution of executions.results) {
            if (execution.jobAssignmentId) {
                try {
                    await resourceManager.delete(execution.jobAssignmentId);
                } catch (error) {
                    logger.warn(`Failed to delete job assignment ${execution.jobAssignmentId}`);
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
