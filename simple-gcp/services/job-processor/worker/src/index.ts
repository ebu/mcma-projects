import { EventFunction, Context } from "@google-cloud/functions-framework/build/src/functions";

import { EnvironmentVariableProvider, Utils } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { CloudLoggingLoggerProvider } from "@mcma/google-cloud-logger";
import { googleAuth } from "@mcma/google-cloud-client";

import { DataController } from "@local/job-processor";

import { cancelJob, deleteJob, failJob, processNotification, restartJob, startJob } from "./operations";
import { Message } from "@google-cloud/pubsub";

const { TableName, PublicUrl } = process.env;

const authProvider = new AuthProvider().add(googleAuth());
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new CloudLoggingLoggerProvider("job-processor-worker");
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const dataController = new DataController(TableName, PublicUrl);

const providerCollection = new ProviderCollection({
    authProvider,
    contextVariableProvider,
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

export const handler: EventFunction = async (message: Message, context: Context) => {
    const messageString = Utils.fromBase64(message.data.toString("utf8"));
    const request: WorkerRequestProperties = JSON.parse(messageString);
    const logger = loggerProvider.get(context.eventId, request.tracker);

    try {
        logger.functionStart(context.eventId);
        logger.debug(context);
        logger.debug(message);

        await worker.doWork(new WorkerRequest(request, logger), { eventId: context.eventId, dataController });
    } catch (error) {
        logger.error("Error occurred when handling operation '" + request.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.eventId);
    }
}
