import { WorkflowJob } from "@mcma/core";

export class JobStatus {
    static readonly NEW = "New";
    static readonly QUEUED = "Queued";
    static readonly SCHEDULED = "Scheduled";
    static readonly RUNNING = "Running";
    static readonly COMPLETED = "Completed";
    static readonly FAILED = "Failed";
    static readonly CANCELED = "Canceled";

    static isFinished(workflowJob: WorkflowJob): boolean {
        return workflowJob.status === JobStatus.COMPLETED || workflowJob.status === JobStatus.FAILED || workflowJob.status === JobStatus.CANCELED;
    }

    static isCompleted(workflowJob: WorkflowJob): boolean {
        return workflowJob.status === JobStatus.COMPLETED;
    }
}
