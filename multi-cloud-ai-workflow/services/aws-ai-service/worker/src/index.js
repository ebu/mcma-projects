//"use strict";
const AWS = require("aws-sdk");
const { AIJob, JobAssignment, EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManagerProvider, AuthProvider } = require("@mcma/client");
const { Worker, WorkerRequest, ProcessJobAssignmentOperation, ProviderCollection } = require("@mcma/worker");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
require("@mcma/aws-client");

const { transcribeAudio, processTranscribeJobResult } = require('./profiles/transcribe-audio');
const { translateText } = require('./profiles/translate-text');
const { ssmlTextToSpeech, processSsmlTextToSpeechJobResult } = require('./profiles/ssml-text-to-speech');
const { textToSpeech, processTextToSpeechJobResult } = require('./profiles/text-to-speech');
const { tokenizedTextToSpeech, processTokenizedTextToSpeechJobResult } = require('./profiles/tokenized-text-to-speech');
const { createDubbingSrt } = require('./profiles/create-dubbing-srt');
const { validateSpeechToText } = require('./profiles/validate-speech-to-text');

const { detectCelebrities } = require('./profiles/detect-celebrities');
const { detectEmotions } = require('./profiles/detect-emotions');
const { processRekognitionResult } = require('./profiles/process-reko-results');

const authProvider = new AuthProvider().addAwsV4Auth(AWS);
const dbTableProvider = new DynamoDbTableProvider(JobAssignment);
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("aws-ai-service-worker", process.env.LogGroupName);
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
        .addProfile("AWSDetectCelebrities", detectCelebrities)
        .addProfile("AWSTranscribeAudio", transcribeAudio)
        .addProfile("AWSTranslateText", translateText)
        .addProfile("AWSSsmlTextToSpeech", ssmlTextToSpeech)
        .addProfile("AWSTextToSpeech", textToSpeech)
        .addProfile("AWSTokenizedTextToSpeech", tokenizedTextToSpeech)
        .addProfile("AWSDetectEmotions", detectEmotions)
        .addProfile("CreateDubbingSrt", createDubbingSrt)
        .addProfile("ValidateSpeechToText", validateSpeechToText);

const worker =
    new Worker(providerCollection)
        .addOperation(processJobAssignmentOperation)
        .addOperation("ProcessRekognitionResult", processRekognitionResult)
        .addOperation("ProcessTranscribeJobResult", processTranscribeJobResult)
        .addOperation("ProcessTextToSpeechJobResult", processTextToSpeechJobResult)
        .addOperation("ProcessSsmlTextToSpeechJobResult", processSsmlTextToSpeechJobResult)
        .addOperation("ProcessTokenizedTextToSpeechJobResult", processTokenizedTextToSpeechJobResult);

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
