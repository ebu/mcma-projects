//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, TransformJob } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProcessJobAssignmentOperation, ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { createProxyLambda } from "./profiles/create-proxy-lambda";
import { extractAudio } from "./profiles/extract-audio";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider();
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("transform-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    contextVariableProvider,
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

export async function handler(event: WorkerRequestProperties, context: Context) {
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
