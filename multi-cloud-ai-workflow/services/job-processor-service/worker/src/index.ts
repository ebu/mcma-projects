import { Context } from "aws-lambda";
import * as AWS from "aws-sdk";

import { EnvironmentVariableProvider } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { createJobAssignment, deleteJobAssignment, processNotification } from "./operations";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const contextVariableProvider = new EnvironmentVariableProvider();
const dbTableProvider = new DynamoDbTableProvider({ ConsistentGet: true });
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    contextVariableProvider,
    dbTableProvider,
    loggerProvider,
    resourceManagerProvider
});

const worker =
    new Worker(providerCollection)
        .addOperation("CreateJobAssignment", createJobAssignment)
        .addOperation("DeleteJobAssignment", deleteJobAssignment)
        .addOperation("ProcessNotification", processNotification);

export async function handler(event: WorkerRequestProperties, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        await worker.doWork(new WorkerRequest(event, logger), context);
    } catch (error) {
        logger.error("Error occurred when handling operation '" + event.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
