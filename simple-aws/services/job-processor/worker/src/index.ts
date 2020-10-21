import { Context } from "aws-lambda";
import * as AWS from "aws-sdk";

import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { DataController } from "@local/job-processor";

import { cancelJob, deleteJob, failJob, processNotification, restartJob, startJob } from "./operations";

const { TableName, PublicUrl } = process.env;

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const dataController = new DataController(TableName, PublicUrl, true);

const providerCollection = new ProviderCollection({
    authProvider,
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

export async function handler(event: WorkerRequestProperties, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        await worker.doWork(new WorkerRequest(event, logger), { awsRequestId: context.awsRequestId, dataController });
    } catch (error) {
        logger.error("Error occurred when handling operation '" + event.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
