//"use strict";
const { Logger, AIJob } = require("mcma-core");
const { WorkerBuilder } = require("mcma-worker");
require("mcma-aws");

const { detectCelebrities, processRekognitionResult } = require('./profiles/detect-celebrities');
const { transcribeAudio, processTranscribeJobResult } = require('./profiles/transcribe-audio');
const { translateText } = require('./profiles/translate-text');

const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(AIJob, x =>
            x.addProfile(detectCelebrities.profileName, detectCelebrities)
             .addProfile(transcribeAudio.profileName, transcribeAudio)
             .addProfile(translateText.profileName, translateText)
        )
        .handleOperation(processRekognitionResult)
        .handleOperation(processTranscribeJobResult)
        .build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        await worker.doWork(event);
    } catch (error) {
        Logger.error("Processing action '" + event.operationName + "' ended with error: '" + error.message + "'");
    }
}