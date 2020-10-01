import { Context, HttpRequest, AzureFunction } from "@azure/functions";
import { McmaApiRouteCollection } from "@mcma/api";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { AzureFunctionApiController } from "@mcma/azure-functions-api";

import { DataController } from "@local/job-processor";
import { JobRoutes } from "./job-routes";
import { JobExecutionRoutes } from "./job-execution-routes";

const { TableName, PublicUrl } = process.env;

const loggerProvider = new AppInsightsLoggerProvider("job-processor-api-handler");

const dataController = new DataController(TableName, PublicUrl);
const jobRoutes = new JobRoutes(dataController);
const jobExecutionRoutes = new JobExecutionRoutes(dataController);

const routes = new McmaApiRouteCollection().addRoutes(jobRoutes).addRoutes(jobExecutionRoutes);

const restController = new AzureFunctionApiController(routes, loggerProvider);

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
}
