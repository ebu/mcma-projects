//"use strict";
const { Logger, AIJob } = require("mcma-core");
const { WorkerBuilder, WorkerRequest } = require("mcma-worker");
require("mcma-aws");

const { extractAudio } = require('./profiles/extract-audio');
const { validateSpeechToTextGoogle } = require('./profiles/validate-speech-to-text-google');

// declare worker with same profileName as defined in initialisation step
const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(AIJob, x =>
            x.addProfile(extractAudio.profileName, extractAudio)
                .addProfile(validateSpeechToTextGoogle.profileName, validateSpeechToTextGoogle)
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
};
