//"use strict";
const { Logger, TransformJob } = require("mcma-core");
const { WorkerBuilder } = require("mcma-worker");
require("mcma-aws");

const { createProxyLambda } = require("./profiles/create-proxy-lambda");
const { createProxyEC2 } = require("./profiles/create-proxy-ec2");

const worker =
    new WorkerBuilder().useAwsJobDefaults()
        .handleJobsOfType(TransformJob, x =>
            x.addProfile(createProxyLambda)
             .addProfile(createProxyEC2)
        )
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
