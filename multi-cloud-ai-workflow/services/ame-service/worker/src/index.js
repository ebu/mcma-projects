//"use strict";
const { Logger, AmeJob } = require("mcma-core");
const { WorkerBuilder, WorkerRequest } = require("mcma-worker");
require("mcma-aws");

const { extractTechnicalMetadata } = require('./profiles/extract-technical-metadata');

const worker = new WorkerBuilder().useAwsJobDefaults().handleJobsOfType(AmeJob, x => x.addProfile(extractTechnicalMetadata)).build();

exports.handler = async (event, context) => {
    try {
        Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
        
        await worker.doWork(new WorkerRequest(event));
    } catch (error) {
        Logger.error("Error occurred when handling action '" + event.operationName + "'")
        Logger.exception(error.toString());
    }
}