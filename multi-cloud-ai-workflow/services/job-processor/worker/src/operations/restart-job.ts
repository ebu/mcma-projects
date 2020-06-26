import { ProviderCollection, WorkerRequest } from "@mcma/worker";

import { DataController } from "@local/job-processor";
import { DynamoDbMutex } from "@mcma/aws-dynamodb";
import { Job, McmaException } from "@mcma/core";
import { startExecution } from "./start-job";
import { cancelExecution } from "./cancel-job";

export async function restartJob(providers: ProviderCollection, workerRequest: WorkerRequest, context: { awsRequestId: string, dataController: DataController }) {
    const jobId = workerRequest.input.jobId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const dataController = context.dataController;
    const mutex = new DynamoDbMutex(jobId, context.awsRequestId, dataController.tableName, logger);

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
