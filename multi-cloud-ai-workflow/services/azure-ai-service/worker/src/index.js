//"use strict";
const { Logger, AIJob } = require("mcma-core");
const { WorkerBuilder } = require("mcma-worker");
require("mcma-aws");

const { extractAllAiMetadata, processNotification } = require("./profiles/extract-all-ai-metadata");
const { transcribeAudio } = require("./profiles/transcribe-audio");
const { translateText } = require("./profiles/translate-text");

const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(AIJob, x =>
            x.addProfile(extractAllAiMetadata.profileName, extractAllAiMetadata)
             .addProfile(transcribeAudio.profileName, transcribeAudio)
             .addProfile(translateText.profileName, translateText)
        )
        .handleOperation(processNotification)
        .build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
        
        await worker.doWork(event);
    } catch (error) {
        Logger.error("Error occurred when handling action '" + event.operationName + "'")
        Logger.exception(error.toString());
    }
}
