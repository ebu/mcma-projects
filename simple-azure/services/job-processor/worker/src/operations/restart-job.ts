import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController, PeriodicJobCheckerCronJob } from "@local/job-processor";
import { Job, McmaException } from "@mcma/core";
import { startExecution } from "./start-job";
import { cancelExecution } from "./cancel-job";

type Context = { requestId: string, dataController: DataController, periodicJobCheckerCronJob: PeriodicJobCheckerCronJob };

export async function restartJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: Context) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get();

    const dataController = context.dataController;
    const mutex = await dataController.createMutex(jobId, context.requestId);

    let job: Job;

    await mutex.lock();
    try {
        job = await dataController.getJob(jobId);
        if (!job) {
            throw new McmaException(`Job with id '${jobId}' not found`);
        }

        job = await cancelExecution(job, dataController, resourceManager, providers.authProvider, logger);

        job = await startExecution(job, dataController, resourceManager, providers.authProvider, logger, context.periodicJobCheckerCronJob);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(job);
}
