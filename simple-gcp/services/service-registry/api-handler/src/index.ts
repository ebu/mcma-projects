import { Request, Response } from "express";
import { JobProfile, Service } from "@mcma/core";
import { DefaultRouteCollection, McmaApiRouteCollection } from "@mcma/api";
import { FirestoreTableProvider } from "@mcma/google-cloud-firestore";
import { CloudLoggingLoggerProvider } from "@mcma/google-cloud-logger";
import { HttpFunctionApiController } from "@mcma/google-cloud-http-functions";

const loggerProvider = new CloudLoggingLoggerProvider("service-registry-api-handler");
const dbTableProvider = new FirestoreTableProvider();

const restController =
    new HttpFunctionApiController(
        new McmaApiRouteCollection()
            .addRoutes(new DefaultRouteCollection(dbTableProvider, Service))
            .addRoutes(new DefaultRouteCollection(dbTableProvider, JobProfile)),
        loggerProvider);

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
