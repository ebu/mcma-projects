//"use strict";
const { Logger, AIJob } = require("mcma-core");
const { WorkerBuilder, WorkerRequest } = require("mcma-worker");
require("mcma-aws");

const { detectCelebrities, processRekognitionResult } = require('./profiles/detect-celebrities');
const { transcribeAudio, processTranscribeJobResult } = require('./profiles/transcribe-audio');
const { translateText } = require('./profiles/translate-text');
const { textToSpeech, processTextToSpeechJobResult } = require('./profiles/text-to-speech');
const { detectEmotions, processRekognitionResult2 } = require('./profiles/detect-emotions');

const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(AIJob, x =>
            x.addProfile(detectCelebrities.profileName, detectCelebrities)
                .addProfile(transcribeAudio.profileName, transcribeAudio)
                .addProfile(translateText.profileName, translateText)
                .addProfile(textToSpeech.profileName, textToSpeech)
                .addProfile(detectEmotions.profileName, detectEmotions)
        )
        .handleOperation(processRekognitionResult)
        .handleOperation(processTranscribeJobResult)
        .handleOperation(processTextToSpeechJobResult)
        .handleOperation(processRekognitionResult2)
        .build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        Logger.error("Processing action '" + event.operationName + "' ended with error: '" + error.message + "'");
    }
}