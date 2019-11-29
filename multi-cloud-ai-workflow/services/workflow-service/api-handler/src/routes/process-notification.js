const { Logger, JobAssignment } = require("mcma-core");
const { DynamoDbTable, invokeLambdaWorker } = require("mcma-aws");
require("mcma-api");

const processNotification = async (requestContext) => {
    const request = requestContext.request;

    Logger.debug("processNotification()", JSON.stringify(request, null, 2));

    const table = new DynamoDbTable(JobAssignment, requestContext.tableName());

    const jobAssignmentId = requestContext.publicUrl() + "/job-assignments/" + request.pathVariables.id;

    const jobAssignment = await table.get(jobAssignmentId);
    if (!requestContext.resourceIfFound(jobAssignment, false)) {
        return;
    }

    const notification = requestContext.isBadRequestDueToMissingBody();
    if (!notification) {
        return;
    }

    await invokeLambdaWorker(requestContext.workerFunctionName(), {
        operationName: "ProcessNotification",
        contextVariables: requestContext.getAllContextVariables(),
        input: {
            jobAssignmentId,
            notification
        }
    });
}

module.exports = {
    processNotification   
};