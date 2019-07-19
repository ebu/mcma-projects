//"use strict";
const AWS = require("aws-sdk");
const { Logger, AmeJob, JobAssignment } = require("@mcma/core");
const { AuthProvider, ResourceManagerProvider } = require("@mcma/client");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const { extractTechnicalMetadata } = require('./profiles/extract-technical-metadata');

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS));
const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const worker =
    new WorkerBuilder()
        .handleJobsOfType(AmeJob,
            dynamoDbTableProvider,
            resourceManagerProvider,
            x => x.addProfile(extractTechnicalMetadata))
        .build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
        
        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        Logger.error("Error occurred when handling action '" + event.operationName + "'");
        Logger.exception(error.toString());
    }
};