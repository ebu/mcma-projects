const { Logger } = require("@mcma/core");

function processNotification(dbTableProvider, workerInvoker) {
    return async function processNotification(requestContext) {
        const request = requestContext.request;

        Logger.debug("processNotification()", JSON.stringify(request, null, 2));

        const table = dbTableProvider.table(requestContext.tableName());

        const jobAssignmentId = requestContext.publicUrl() + "/job-assignments/" + request.pathVariables.id;

        const jobAssignment = await table.get(jobAssignmentId);
        if (!requestContext.resourceIfFound(jobAssignment, false)) {
            return;
        }

        const notification = requestContext.isBadRequestDueToMissingBody();
        if (!notification) {
            return;
        }

        await workerInvoker.invoke(
            requestContext.workerFunctionId(),
            "ProcessNotification",
            requestContext.getAllContextVariables(),
            {
                jobAssignmentId,
                notification
            }
        );
    };
}

module.exports = {
    processNotification   
};