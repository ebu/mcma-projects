import { AzureFunction, Context } from "@azure/functions";
import { TransformJob } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProcessJobAssignmentOperation, ProviderCollection, Worker, WorkerRequest } from "@mcma/worker";
import { CosmosDbTableProvider, fillOptionsFromEnvironmentVariables } from "@mcma/azure-cosmos-db";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { azureAdManagedIdentityAuth } from "@mcma/azure-client";

import { extractThumbnail } from "./profiles/extract-thumbnail";
import { setHostRootDir } from "./ffmpeg";

const authProvider = new AuthProvider().add(azureAdManagedIdentityAuth());
const dbTableProvider = new CosmosDbTableProvider(fillOptionsFromEnvironmentVariables());
const loggerProvider = new AppInsightsLoggerProvider("ffmpeg-service-worker");
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    loggerProvider,
    resourceManagerProvider
});

const processJobAssignmentOperation =
    new ProcessJobAssignmentOperation(TransformJob)
        .addProfile("ExtractThumbnail", extractThumbnail);

const worker =
    new Worker(providerCollection)
        .addOperation(processJobAssignmentOperation);

export const handler: AzureFunction = async (context: Context) => {
    const queueMessage = context.bindings.queueMessage;
    const logger = loggerProvider.get(context.invocationId, queueMessage.tracker);

    try {
        logger.functionStart(context.invocationId);
        logger.debug(context);
        logger.debug(queueMessage);

        setHostRootDir(context.executionContext.functionDirectory);

        await worker.doWork(new WorkerRequest(queueMessage, logger));
    } catch (error) {
        logger.error("Error occurred when handling operation '" + queueMessage.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.invocationId);
    }
}
