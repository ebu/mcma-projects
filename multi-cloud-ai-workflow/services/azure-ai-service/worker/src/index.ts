//"use strict";
import { Context } from "aws-lambda";
import * as AWS from "aws-sdk";
import { AIJob, EnvironmentVariableProvider } from "@mcma/core";
import { ResourceManagerProvider, AuthProvider } from "@mcma/client";
import { Worker, WorkerRequest, ProcessJobAssignmentOperation, ProviderCollection, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { extractAllAiMetadata, processNotification } from "./profiles/extract-all-ai-metadata";
import { validateSpeechToTextAzure } from "./profiles/validate-speech-to-text-azure";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider();
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("azure-ai-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    contextVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const processJobAssignmentOperation =
    new ProcessJobAssignmentOperation(AIJob)
        .addProfile("AzureExtractAllAIMetadata", extractAllAiMetadata)
        .addProfile("ValidateSpeechToTextAzure", validateSpeechToTextAzure);

const worker =
    new Worker(providerCollection)
        .addOperation(processJobAssignmentOperation)
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
