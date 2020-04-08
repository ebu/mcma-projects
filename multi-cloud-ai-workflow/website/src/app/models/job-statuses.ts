import { WorkflowJob, JobStatus } from "@mcma/core";

export function isFinished(workflowJob: WorkflowJob): boolean {
    return workflowJob.status &&
        (JobStatus.Completed.toLowerCase() === workflowJob.status.toLowerCase() || JobStatus.Failed.toLowerCase() === workflowJob.status.toLowerCase());
}

export function isCompleted(workflowJob: WorkflowJob): boolean {
    return workflowJob.status && JobStatus.Completed.toLowerCase() === workflowJob.status.toLowerCase();
}