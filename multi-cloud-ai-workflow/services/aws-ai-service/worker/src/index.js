//"use strict";
const AWS = require("aws-sdk");
const { Logger, AIJob, JobAssignment } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { WorkerBuilder, WorkerRequest } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-client");

const { detectCelebrities, processRekognitionResult } = require('./profiles/detect-celebrities');
const { transcribeAudio, processTranscribeJobResult } = require('./profiles/transcribe-audio');
const { translateText } = require('./profiles/translate-text');

const resourceManagerProvider = new ResourceManagerProvider(new AuthProvider().addAwsV4Auth(AWS));
const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const worker =
    new WorkerBuilder()
        .handleJobsOfType(
            AIJob,
            dynamoDbTableProvider,
            resourceManagerProvider,
            x =>
                x.addProfile(detectCelebrities.profileName, detectCelebrities)
                 .addProfile(transcribeAudio.profileName, transcribeAudio)
                 .addProfile(translateText.profileName, translateText)
        )
        .handleOperation(processRekognitionResult(resourceManagerProvider, dynamoDbTableProvider))
        .handleOperation(processTranscribeJobResult(resourceManagerProvider, dynamoDbTableProvider))
        .build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        Logger.error("Processing action '" + event.operationName + "' ended with error: '" + error.message + "'");
    }
}