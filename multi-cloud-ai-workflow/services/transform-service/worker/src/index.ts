//"use strict";
import * as AWS from "aws-sdk";

import { EnvironmentVariableProvider, JobAssignment, TransformJob } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProcessJobAssignmentOperation, ProviderCollection, Worker, WorkerRequest } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import "@mcma/aws-client";

import { createProxyLambda } from "./profiles/create-proxy-lambda";
import { extractAudio } from "./profiles/extract-audio";

const authProvider = new AuthProvider().addAwsV4Auth(AWS);
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("transform-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    environmentVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const processJobAssignmentOperation =
    new ProcessJobAssignmentOperation(TransformJob)
        .addProfile("CreateProxyLambda", createProxyLambda)
        .addProfile("ExtractAudio", extractAudio);

const worker =
    new Worker(providerCollection)
        .addOperation(processJobAssignmentOperation);

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
