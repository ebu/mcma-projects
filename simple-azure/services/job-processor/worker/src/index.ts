import { AzureFunction, Context } from "@azure/functions";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProviderCollection, Worker, WorkerRequest } from "@mcma/worker";
import { azureAdManagedIdentityAuth } from "@mcma/azure-client";

import { DataController, PeriodicJobCheckerCronJob } from "@local/job-processor";

import { cancelJob, deleteJob, failJob, processNotification, restartJob, startJob } from "./operations";

const { TableName, PublicUrl } = process.env;

const authProvider = new AuthProvider().add(azureAdManagedIdentityAuth());
const loggerProvider = new AppInsightsLoggerProvider("job-processor-worker");
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const dataController = new DataController(TableName, PublicUrl);
const periodicJobCheckerCronJob = new PeriodicJobCheckerCronJob();

const providerCollection = new ProviderCollection({
    authProvider,
    loggerProvider,
    resourceManagerProvider
});

const worker =
    new Worker(providerCollection)
        .addOperation("CancelJob", cancelJob)
        .addOperation("DeleteJob", deleteJob)
        .addOperation("FailJob", failJob)
        .addOperation("ProcessNotification", processNotification)
        .addOperation("RestartJob", restartJob)
        .addOperation("StartJob", startJob);

export const handler: AzureFunction = async (context: Context) => {
    const queueMessage = context.bindings.queueMessage;
    const logger = loggerProvider.get(context.invocationId, queueMessage.tracker);

    try {
        logger.functionStart(context.invocationId);
        logger.debug(queueMessage);
        logger.debug(context);

        await worker.doWork(
            new WorkerRequest(queueMessage, logger),
            {
                requestId: context.invocationId,
                dataController,
                periodicJobCheckerCronJob
            });
    } catch (error) {
        logger.error("Error occurred when handling operation '" + queueMessage.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.invocationId);
        loggerProvider.flush();
    }
};
