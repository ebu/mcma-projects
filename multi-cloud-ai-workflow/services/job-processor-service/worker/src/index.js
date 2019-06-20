//"use strict";

const { WorkerBuilder } = require("mcma-worker");

const createJobAssignment = require("./operations/create-job-assignment");
const deleteJobAssignment = require("./operations/delete-job-assignment");
const processNotification = require("./operations/process-notification");

const worker =
    new WorkerBuilder()
        .handleOperation(createJobAssignment)
        .handleOperation(deleteJobAssignment)
        .handleOperation(processNotification)
        .build();

exports.handler = async (event, context) => {
    try {
        console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

        await worker.doWork(event);
    } catch (error) {
        console.log("Error occurred when handling action '" + event.operationName + "'")
        console.log(error.toString());
    }
}
