import { Request, Response } from "express";
import { DefaultJobRouteCollection } from "@mcma/api";
import { FirestoreTableProvider } from "@mcma/google-cloud-firestore";
import { invokePubSubTriggeredWorker } from "@mcma/google-cloud-pubsub-worker-invoker";
import { CloudLoggingLoggerProvider } from "@mcma/google-cloud-logger";
import { HttpFunctionApiController } from "@mcma/google-cloud-http-functions";

const loggerProvider = new CloudLoggingLoggerProvider("mediainfo-service-api-handler");
const dbTableProvider = new FirestoreTableProvider();

const restController = new HttpFunctionApiController(new DefaultJobRouteCollection(dbTableProvider, invokePubSubTriggeredWorker), loggerProvider);

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
