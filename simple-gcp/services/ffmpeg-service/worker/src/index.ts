import { EventFunction, Context } from "@google-cloud/functions-framework/build/src/functions";
import { Message } from "@google-cloud/pubsub";
import { Logger, TransformJob, Utils } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProcessJobAssignmentOperation, ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { FirestoreTableProvider } from "@mcma/google-cloud-firestore";
import { CloudLoggingLoggerProvider } from "@mcma/google-cloud-logger";
import { googleAuth } from "@mcma/google-cloud-client";

import { extractThumbnail } from "./profiles/extract-thumbnail";

const authProvider = new AuthProvider().add(googleAuth());
const dbTableProvider = new FirestoreTableProvider();
const loggerProvider = new CloudLoggingLoggerProvider("ffmpeg-service-worker");
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

export const handler: EventFunction = async (message: Message, context: Context) => {
    let logger = Logger.System;
    let request: WorkerRequestProperties;
    try {
        request = JSON.parse(Utils.fromBase64(message.data.toString("utf8")));
        logger = loggerProvider.get(context.eventId, request.tracker);

        logger.functionStart(context.eventId);
        logger.debug(context);
        logger.debug(message);

        await worker.doWork(new WorkerRequest(request, logger));
    } catch (error) {
        logger.error("Error occurred when handling operation '" + (request?.operationName ?? "unknown") + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.eventId);
    }
};
