import { Context, HttpRequest, AzureFunction } from "@azure/functions";
import { DefaultJobRouteCollection } from "@mcma/api";
import { CosmosDbTableProvider, fillOptionsFromEnvironmentVariables } from "@mcma/azure-cosmos-db";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { AzureFunctionApiController } from "@mcma/azure-functions-api";
import { invokeQueueTriggeredWorker } from "@mcma/azure-queue-worker-invoker";

const loggerProvider = new AppInsightsLoggerProvider("mediainfo-service-api-handler");
const dbTableProvider = new CosmosDbTableProvider(fillOptionsFromEnvironmentVariables());

const restController =
    new AzureFunctionApiController(
        new DefaultJobRouteCollection(dbTableProvider, invokeQueueTriggeredWorker),
        loggerProvider);

export const handler: AzureFunction = async (context: Context, request: HttpRequest) => {
    const logger = loggerProvider.get(context.invocationId);
    try {
        logger.functionStart(context.invocationId);
        logger.debug(context);
        logger.debug(request);

        return await restController.handleRequest(request);
    } finally {
        logger.functionEnd(context.invocationId);
    }
};
