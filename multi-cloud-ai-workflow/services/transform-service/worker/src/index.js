//"use strict";
const AWS = require("aws-sdk");
const { Logger, TransformJob } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const { createProxyLambda } = require("./profiles/create-proxy-lambda");
const { createProxyEC2 } = require("./profiles/create-proxy-ec2");

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);

const worker =
    new WorkerBuilder()
        .handleJobsOfType(
            TransformJob,
            dbTableProvider,
            resourceManagerProvider,
            x =>
                x.addProfile(createProxyLambda)
                .addProfile(createProxyEC2)
        )
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
