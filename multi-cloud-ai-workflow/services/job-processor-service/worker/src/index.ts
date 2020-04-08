//"use strict";
import { Context } from "aws-lambda";
import * as AWS from "aws-sdk";

import { EnvironmentVariableProvider } from "@mcma/core";
import { ResourceManagerProvider, AuthProvider } from "@mcma/client";
import { Worker, WorkerRequest, ProviderCollection, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { createJobAssignment } from "./operations/create-job-assignment";
import { deleteJobAssignment } from "./operations/delete-job-assignment";
import { processNotification } from "./operations/process-notification";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider();
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    contextVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const worker =
    new Worker(providerCollection)
        .addOperation("CreateJobAssignment", createJobAssignment)
        .addOperation("DeleteJobAssignment", deleteJobAssignment)
        .addOperation("ProcessNotification", processNotification);

export const handler = async (event: WorkerRequestProperties, context: Context) => {
    const logger = loggerProvider.get(event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        logger.error("Error occurred when handling operation '" + event.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
