import { Context, HttpRequest, AzureFunction } from "@azure/functions";
import { DefaultRouteCollection, McmaApiRouteCollection } from "@mcma/api";
import { CosmosDbTableProvider, fillOptionsFromEnvironmentVariables } from "@mcma/azure-cosmos-db";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { AzureFunctionApiController } from "@mcma/azure-functions-api";
import { JobProfile, Service } from "@mcma/core";

const loggerProvider = new AppInsightsLoggerProvider("service-registry-api-handler");
const dbTableProvider = new CosmosDbTableProvider(fillOptionsFromEnvironmentVariables());

const restController =
    new AzureFunctionApiController(
        new McmaApiRouteCollection()
            .addRoutes(new DefaultRouteCollection(dbTableProvider, Service))
            .addRoutes(new DefaultRouteCollection(dbTableProvider, JobProfile)),
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
        loggerProvider.flush();
    }
};
