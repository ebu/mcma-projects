//"use strict";
import * as AWS from "aws-sdk";

import { EnvironmentVariableProvider } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ProviderCollection, Worker, WorkerRequest } from "@mcma/worker";
import "@mcma/aws-client";

import { processNotification } from "./operations/process-notification";
import { deleteJobProcess } from "./operations/delete-job-process";
import { createJobProcess } from "./operations/create-job-process";

const authProvider = new AuthProvider().addAwsV4Auth(AWS);
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-repository-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    environmentVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const worker =
    new Worker(providerCollection)
        .addOperation("CreateJobProcess", createJobProcess)
        .addOperation("DeleteJobProcess", deleteJobProcess)
        .addOperation("ProcessNotification", processNotification);

export async function handler(event, context) {
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
}
