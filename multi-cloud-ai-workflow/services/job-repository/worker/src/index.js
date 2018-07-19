//"use strict";

const AWS = require("aws-sdk");

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    let jobId = event.jobId;

    let jobProcess = new MCMA_CORE.JobProcess(jobId);

    jobProcess = await resourceManager.create(jobProcess);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let job = await table.get("Job", jobId);

    job.status = "QUEUED";
    job.jobProcess = jobProcess.id;

    await table.put("Job", jobId, job);
}