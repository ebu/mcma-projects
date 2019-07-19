const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsStartExecution = util.promisify(StepFunctions.startExecution.bind(StepFunctions));

const { NotificationEndpoint } = require("@mcma/core");

async function runWorkflow(workerJobHelper) {
    // 6. Launch the appropriate workflow
    const workflowInput = {
        input: workerJobHelper.getJobInput(),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: workerJobHelper.getJobAssignmentId() + "/notifications"
        })
    };

    const workflowName = workerJobHelper.getMatchedProfileName();

    const stateMachineArn = workerJobHelper.getRequest().getOptionalContextVariable(workflowName + "Id");
    if (!stateMachineArn) {
        throw new Error("No state machine ARN found for workflow '" + workflowName +"'");
    }

    await StepFunctionsStartExecution({
        input: JSON.stringify(workflowInput),
        stateMachineArn
    });
}

function processNotification(resourceManagerProvider, dbTableProvider) {
    return async function processNotification(request) {
        const jobAssignmentId = request.input.jobAssignmentId;
        const notification = request.input.notification;

        const table = dbTableProvider.table(request.tableName());

        const jobAssignment = await table.get(jobAssignmentId);

        jobAssignment.status = notification.content.status;
        jobAssignment.statusMessage = notification.content.statusMessage;
        if (notification.content.progress !== undefined) {
            jobAssignment.progress = notification.content.progress;
        }
        jobAssignment.jobOutput = notification.content.output;
        jobAssignment.dateModified = new Date().toISOString();

        await table.put(jobAssignmentId, jobAssignment);

        const resourceManager = resourceManagerProvider.get(request);

        await resourceManager.sendNotification(jobAssignment);
    };
}

module.exports = {
    runWorkflow,
    processNotification
};