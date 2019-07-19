//"use strict";
const AWS = require("aws-sdk");

const { JobProcess } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const createJobAssignment = require("./operations/create-job-assignment");
const deleteJobAssignment = require("./operations/delete-job-assignment");
const processNotification = require("./operations/process-notification");

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider(JobProcess);

const worker =
    new WorkerBuilder()
        .handleOperation(createJobAssignment(resourceManagerProvider, dbTableProvider))
        .handleOperation(deleteJobAssignment(resourceManagerProvider))
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
}
