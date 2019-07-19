//"use strict";
const AWS = require("aws-sdk");

const { Job } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const createJobProcess = require("./operations/create-job-process");
const deleteJobProcess = require("./operations/delete-job-process");
const processNotification = require("./operations/process-notification");

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS.config));
const dbTableProvider = new DynamoDbTableProvider(Job);

const worker =
    new WorkerBuilder()
        .handleOperation(createJobProcess(resourceManagerProvider, dbTableProvider))
        .handleOperation(deleteJobProcess(resourceManagerProvider))
        .handleOperation(processNotification(resourceManagerProvider, dbTableProvider))
        .build();

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
        
        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        console.log("Error occurred when handling action '" + event.operationName + "'")
        console.log(error.toString());
    }
};