//"use strict";
const AWS = require("aws-sdk");

const { Logger, AIJob, JobAssignment } = require("@mcma/core");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const { extractAllAiMetadata, processNotification } = require("./profiles/extract-all-ai-metadata");
// const { transcribeAudio } = require("./profiles/transcribe-audio");
// const { translateText } = require("./profiles/translate-text");

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS));
const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const worker =
    new WorkerBuilder()
        .handleJobsOfType(
            AIJob,
            dynamoDbTableProvider,
            resourceManagerProvider,
            x =>
                x.addProfile(extractAllAiMetadata.profileName, extractAllAiMetadata)
        )
        .handleOperation(processNotification(resourceManagerProvider, dynamoDbTableProvider))
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
