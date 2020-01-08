//"use strict";
const AWS = require("aws-sdk");
const { AIJob, JobAssignment, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { Worker, WorkerRequest, ProcessJobAssignmentOperation, ProviderCollection } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const { extractAllAiMetadata, processNotification } = require("./profiles/extract-all-ai-metadata");
const { validateSpeechToTextAzure } = require('./profiles/validate-speech-to-text-azure');

const authProvider = new AuthProvider().addAwsV4Auth(AWS);
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("azure-ai-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    environmentVariableProvider,
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

exports.handler = async (event, context) => {
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
