const util = require("util");

const AWS = require("aws-sdk");
const StepFunctions = new AWS.StepFunctions();
const StepFunctionsStartExecution = util.promisify(StepFunctions.startExecution.bind(StepFunctions));

const { JobAssignment, NotificationEndpoint } = require("mcma-core");
const { getAwsV4ResourceManager, dynamoDbTableProvider } = require("mcma-aws");

const createResourceManager = () => getAwsV4ResourceManager.getResourceManager;

function runWorkflow(workerJobHelper) {
    // 6. Launch the appropriate workflow
    const workflowInput = {
        input: workerJobHelper.getJobInput(),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: workerJobHelper.getJobAssignmentId() + "/notifications"
        })
    };

    const workflowName = workerJobHelper.getMatchedProfileName();

    const stateMachineArn = workerJobHelper.request.getOptionalContextVariable(workflowName + "Id");
    if (!stateMachineArn) {
        throw new Error("No state machine ARN found for workflow '" + workflowName +"'");
    }

    await StepFunctionsStartExecution({
        input: JSON.stringify(workflowInput),
        stateMachineArn
    });
}

const processNotification = async (request) => {
    const jobAssignmentId = request.input.jobAssignmentId;
    const notification = request.input.notification;

    const table = dynamoDbTableProvider(JobAssignment).table(request.tableName());

    const jobAssignment = await table.get(jobAssignmentId);

    jobAssignment.status = notification.content.status;
    jobAssignment.statusMessage = notification.content.statusMessage;
    if (notification.content.progress !== undefined) {
        jobAssignment.progress = notification.content.progress;
    }
    jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date().toISOString();

    await table.put(jobAssignmentId, jobAssignment);

    const resourceManager = createResourceManager(request);

    await resourceManager.sendNotification(jobAssignment);
}

module.exports = {
    runWorkflow,
    processNotification
};