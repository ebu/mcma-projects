import { Job, McmaException } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController } from "@local/job-processor";
import { startExecution } from "./start-job";
import { cancelExecution } from "./cancel-job";

export async function restartJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { eventId: string, dataController: DataController }) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(providers.contextVariableProvider);

    const dataController = context.dataController;
    const mutex = await dataController.createMutex(jobId, context.eventId);

    let job: Job;

    await mutex.lock();
    try {
        job = await dataController.getJob(jobId);
        if (!job) {
            throw new McmaException(`Job with id '${jobId}' not found`);
        }

        job = await cancelExecution(job, dataController, resourceManager, providers.authProvider, logger);

        job = await startExecution(job, dataController, resourceManager, providers.authProvider, logger);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(job);
}
