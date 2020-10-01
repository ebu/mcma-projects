import { AzureFunction, Context } from "@azure/functions";
import { AmeJob, EnvironmentVariableProvider } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProcessJobAssignmentOperation, ProviderCollection, Worker, WorkerRequest } from "@mcma/worker";
import { CosmosDbTableProvider, fillOptionsFromEnvironmentVariables } from "@mcma/azure-cosmos-db";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { azureAdManagedIdentityAuth } from "@mcma/azure-client";

import { extractTechnicalMetadata } from "./profiles/extract-technical-metadata";
import { setHostRootDir } from "./media-info";

const authProvider = new AuthProvider().add(azureAdManagedIdentityAuth());
const dbTableProvider = new CosmosDbTableProvider(fillOptionsFromEnvironmentVariables());
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AppInsightsLoggerProvider("mediainfo-service-worker");
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    contextVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const processJobAssignmentOperation =
    new ProcessJobAssignmentOperation(AmeJob)
        .addProfile("ExtractTechnicalMetadata", extractTechnicalMetadata);

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
