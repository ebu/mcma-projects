//"use strict";
const AWS = require("aws-sdk");
const { Logger, WorkflowJob, JobAssignment } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const { runWorkflow, processNotification } = require("./profiles/run-workflow");

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);

const worker =
    new WorkerBuilder()
        .handleJobsOfType(
            WorkflowJob,
            dbTableProvider,
            resourceManagerProvider,
            x =>
                x.addProfile("ConformWorkflow", runWorkflow)
                .addProfile("AIWorkflow", runWorkflow)
        )
        .handleOperation(processNotification(resourceManagerProvider, dbTableProvider))
        .build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
        
        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        Logger.error("Error occurred when handling action '" + event.operationName + "'")
        Logger.exception(error.toString());
    }
}
