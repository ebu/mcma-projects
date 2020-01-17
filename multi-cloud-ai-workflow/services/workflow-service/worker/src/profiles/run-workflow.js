const AWS = require("aws-sdk");
const { Exception, NotificationEndpoint } = require("@mcma/core");

const StepFunctions = new AWS.StepFunctions();

async function runWorkflow(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    // Launch the appropriate workflow
    const workflowInput = {
        input: jobAssignmentHelper.getJobInput(),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: jobAssignmentHelper.getJobAssignmentId() + "/notifications"
        }),
        tracker: jobAssignmentHelper.getJobAssignment().tracker
    };

    const workflowName = jobAssignmentHelper.getProfile().name;

    const stateMachineArn = jobAssignmentHelper.getRequest().getOptionalContextVariable(workflowName + "Id");
    if (!stateMachineArn) {
        throw new Exception("No state machine ARN found for workflow '" + workflowName + "'");
    }

    logger.info("Starting execution of workflow '" + workflowName + "' with input:", workflowInput);
    await StepFunctions.startExecution({
        input: JSON.stringify(workflowInput),
        stateMachineArn
    }).promise();
}

async function processNotification(providers, workerRequest) {
    const jobAssignmentId = workerRequest.input.jobAssignmentId;
    const notification = workerRequest.input.notification;

    const table = providers.getDbTableProvider().get(workerRequest.tableName());

    const jobAssignment = await table.get(jobAssignmentId);

    if (notification.content.status !== undefined) {
        jobAssignment.status = notification.content.status;
        jobAssignment.statusMessage = notification.content.statusMessage;
    }
    if (notification.content.progress !== undefined) {
        jobAssignment.progress = notification.content.progress;
    }
    jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date().toISOString();

    await table.put(jobAssignmentId, jobAssignment);

    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);

    await resourceManager.sendNotification(jobAssignment);
}

module.exports = {
    runWorkflow,
    processNotification
};
