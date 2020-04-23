//"use strict";
import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AmeJob, JobAssignment, EnvironmentVariableProvider } from "@mcma/core";
import { ResourceManagerProvider, AuthProvider } from "@mcma/client";
import { Worker, WorkerRequest, ProcessJobAssignmentOperation, ProviderCollection, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { extractTechnicalMetadata }  from "./profiles/extract-technical-metadata";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider();
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("ame-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    contextVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const processJobAssignmentOperation =
    new ProcessJobAssignmentOperation(AmeJob)
        .addProfile("ExtractTechnicalMetadata", extractTechnicalMetadata);

const worker =
    new Worker(providerCollection)
        .addOperation(processJobAssignmentOperation);

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
