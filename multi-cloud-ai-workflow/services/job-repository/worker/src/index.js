//"use strict";

const { WorkerBuilder } = require("mcma-worker");

const createJobProcess = require("./operations/create-job-process");
const deleteJobProcess = require("./operations/delete-job-process");
const processNotification = require("./operations/process-notification");

const worker =
    new WorkerBuilder()
        .handleOperation("CreateJobProcess", x => x.handle(createJobProcess))
        .handleOperation("DeleteJobProcess", x => x.handle(deleteJobProcess))
        .handleOperation("ProcessJobNotification", x => x.handle(processNotification))
        .build();

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
        
        await worker.doWork(event);
    } catch (error) {
        console.log("Error occurred when handling action '" + event.operationName + "'")
        console.log(error.toString());
    }
};