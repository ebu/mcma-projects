//"use strict";
const AWS = require("aws-sdk");

const { JobProcess, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { Worker, WorkerRequest, ProviderCollection } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const { createJobAssignment } = require("./operations/create-job-assignment");
const { deleteJobAssignment } = require("./operations/delete-job-assignment");
const { processNotification } = require("./operations/process-notification");

const authProvider = new AuthProvider().addAwsV4Auth(AWS);
const dbTableProvider = new DynamoDbTableProvider(JobProcess);
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    environmentVariableProvider,
    loggerProvider,
    resourceManagerProvider
});

const worker =
    new Worker(providerCollection)
        .addOperation("CreateJobAssignment", createJobAssignment)
        .addOperation("DeleteJobAssignment", deleteJobAssignment)
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
