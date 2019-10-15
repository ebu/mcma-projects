//"use strict";
const { Logger, AIJob } = require("mcma-core");
const { WorkerBuilder, WorkerRequest } = require("mcma-worker");
require("mcma-aws");

const { createDubbingSrt } = require('./profiles/create-dubbing-srt');


const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(AIJob, x =>
            x.addProfile(createDubbingSrt.profileName, createDubbingSrt)
        )
        .handleOperation(processNotification)
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
