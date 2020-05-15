import { Context } from "aws-lambda";
import * as AWS from "aws-sdk";
import { AIJob, EnvironmentVariableProvider } from "@mcma/core";
import { AuthProvider, ResourceManagerProvider } from "@mcma/client";
import { ProcessJobAssignmentOperation, ProviderCollection, Worker, WorkerRequest, WorkerRequestProperties } from "@mcma/worker";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";

import { processTranscribeJobResult, transcribeAudio } from "./profiles/transcribe-audio";
import { translateText } from "./profiles/translate-text";
import { processSsmlTextToSpeechJobResult, ssmlTextToSpeech } from "./profiles/ssml-text-to-speech";
import { processTextToSpeechJobResult, textToSpeech } from "./profiles/text-to-speech";
import { processTokenizedTextToSpeechJobResult, tokenizedTextToSpeech } from "./profiles/tokenized-text-to-speech";
import { createDubbingSrt } from "./profiles/create-dubbing-srt";
import { validateSpeechToText } from "./profiles/validate-speech-to-text";

import { detectCelebrities } from "./profiles/detect-celebrities";
import { detectEmotions } from "./profiles/detect-emotions";
import { processRekognitionResult } from "./profiles/process-reko-results";

const authProvider = new AuthProvider().add(awsV4Auth(AWS));
const dbTableProvider = new DynamoDbTableProvider();
const contextVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("aws-ai-service-worker", process.env.LogGroupName);
const resourceManagerProvider = new ResourceManagerProvider(authProvider);

const providerCollection = new ProviderCollection({
    authProvider,
    dbTableProvider,
    contextVariableProvider,
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

export async function handler(event: WorkerRequestProperties, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        await worker.doWork(new WorkerRequest(event, logger));
    } catch (error) {
        logger.error("Error occurred when handling operation '" + event.operationName + "'");
        logger.error(error.toString());
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
