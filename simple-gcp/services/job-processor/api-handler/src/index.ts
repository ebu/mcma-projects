import { Request, Response } from "express";
import { McmaApiRouteCollection } from "@mcma/api";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { googleAuth } from "@mcma/google-cloud-client";
import { HttpFunctionApiController } from "@mcma/google-cloud-http-functions";
import { CloudLoggingLoggerProvider } from "@mcma/google-cloud-logger";
import { PubSubTriggeredWorkerInvoker } from "@mcma/google-cloud-pubsub-worker-invoker";

import { DataController } from "@local/job-processor";
import { JobRoutes } from "./job-routes";
import { JobExecutionRoutes } from "./job-execution-routes";

const { TableName, PublicUrl } = process.env;

const loggerProvider = new CloudLoggingLoggerProvider("job-processor-api-handler");
const authProvider = new AuthProvider().add(googleAuth());
const resourceManagerProvider = new ResourceManagerProvider(authProvider);
const workerInvoker = new PubSubTriggeredWorkerInvoker();

const dataController = new DataController(TableName, PublicUrl);
const jobRoutes = new JobRoutes(dataController, resourceManagerProvider, workerInvoker);
const jobExecutionRoutes = new JobExecutionRoutes(dataController, workerInvoker);

const routes = new McmaApiRouteCollection().addRoutes(jobRoutes).addRoutes(jobExecutionRoutes);

const restController = new HttpFunctionApiController(routes, loggerProvider);

export async function handler(req: Request, res: Response) {
    const executionId = req.get("function-execution-id");
    const logger = loggerProvider.get(executionId);
    try {
        logger.functionStart(executionId);
        logger.debug(req);

        await restController.handleRequest(req, res);
    } finally {
        logger.functionEnd(executionId);
    }
}
