import { WorkflowJob, JobStatus } from "@mcma/core";

export function isFinished(workflowJob: WorkflowJob): boolean {
    return JobStatus.completed.equals(workflowJob.status) || JobStatus.failed.equals(workflowJob.status);
}

export function isCompleted(workflowJob: WorkflowJob): boolean {
    return JobStatus.completed.equals(workflowJob.status);
}