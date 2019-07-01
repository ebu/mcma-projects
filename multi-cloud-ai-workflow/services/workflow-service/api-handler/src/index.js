//"use strict";
const { Logger, JobAssignment } = require("mcma-core");
const { awsDefaultRoutes, invokeLambdaWorker } = require("mcma-aws");

const { processNotification } = require("./routes/process-notification");

const restController =
    awsDefaultRoutes(JobAssignment).withDynamoDb().forJobAssignments(invokeLambdaWorker)
        .addRoute("POST", "/job-assignments/{id}/notifications", processNotification)
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    Logger.debug(JSON.stringify(event, null, 2));
    Logger.debug(JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}