import * as AWS from "aws-sdk";
import { getTableName, JobAssignment, McmaException, NotificationEndpoint, WorkflowJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection, WorkerRequest } from "@mcma/worker";

const StepFunctions = new AWS.StepFunctions();

export async function runWorkflow(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<WorkflowJob>) {
    const logger = jobAssignmentHelper.logger;

    // Launch the appropriate workflow
    const workflowInput = {
        input: jobAssignmentHelper.jobInput,
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: jobAssignmentHelper.jobAssignmentId + "/notifications"
        }),
        tracker: jobAssignmentHelper.jobAssignment.tracker
    };

    const workflowName = jobAssignmentHelper.profile.name;

    const stateMachineArn = jobAssignmentHelper.workerRequest.getOptionalContextVariable<string>(workflowName + "Id");
    if (!stateMachineArn) {
        throw new McmaException("No state machine ARN found for workflow '" + workflowName + "'");
    }

    logger.info("Starting execution of workflow '" + workflowName + "' with input:", workflowInput);
    await StepFunctions.startExecution({
        input: JSON.stringify(workflowInput),
        stateMachineArn
    }).promise();
}

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentId = workerRequest.input.jobAssignmentId;
    const notification = workerRequest.input.notification;

    const table = providers.dbTableProvider.get(getTableName(workerRequest), JobAssignment);

    const jobAssignment = await table.get(jobAssignmentId);

    if (notification.content.status !== undefined) {
        jobAssignment.status = notification.content.status;
        jobAssignment.error = notification.content.error;
    }
    if (notification.content.progress !== undefined) {
        jobAssignment.progress = notification.content.progress;
    }
    jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date();

    await table.put(jobAssignmentId, jobAssignment);

    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    await resourceManager.sendNotification(jobAssignment);
}
