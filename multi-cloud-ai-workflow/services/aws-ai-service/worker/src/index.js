//"use strict";
const { Logger, AIJob } = require("mcma-core");
const { WorkerBuilder, WorkerRequest } = require("mcma-worker");
require("mcma-aws");

const { transcribeAudio, processTranscribeJobResult } = require('./profiles/transcribe-audio');
const { translateText } = require('./profiles/translate-text');
const { ssmlTextToSpeech, processSsmlTextToSpeechJobResult } = require('./profiles/ssml-text-to-speech');
const { textToSpeech, processTextToSpeechJobResult } = require('./profiles/text-to-speech');
const { tokenizedTextToSpeech, processTokenizedTextToSpeechJobResult } = require('./profiles/tokenized-text-to-speech');
const { createDubbingSrt } = require('./profiles/create-dubbing-srt');

const { detectCelebrities } = require('./profiles/detect-celebrities');
const { detectEmotions } = require('./profiles/detect-emotions');
const { processRekognitionResult } = require('./profiles/process-reko-results');

const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(AIJob, x =>
            x.addProfile(detectCelebrities.profileName, detectCelebrities)
                .addProfile(transcribeAudio.profileName, transcribeAudio)
                .addProfile(translateText.profileName, translateText)
                .addProfile(ssmlTextToSpeech.profileName, ssmlTextToSpeech)
                .addProfile(textToSpeech.profileName, textToSpeech)
                .addProfile(tokenizedTextToSpeech.profileName, tokenizedTextToSpeech)
                .addProfile(detectEmotions.profileName, detectEmotions)
                .addProfile(createDubbingSrt.profileName, createDubbingSrt)
                .addProfile(detectEmotions.profileName, detectEmotions)
        )
        .handleOperation(processRekognitionResult)
        .handleOperation(processTranscribeJobResult)
        .handleOperation(processTextToSpeechJobResult)
        .handleOperation(processSsmlTextToSpeechJobResult)
        .handleOperation(processTokenizedTextToSpeechJobResult)
        .build();



exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        Logger.error("Processing action '" + event.operationName + "' ended with error: '" + error.message + "'");
    }
}