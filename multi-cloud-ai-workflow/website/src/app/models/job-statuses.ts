import { WorkflowJob } from 'mcma-core';

export class JobStatus {
    static readonly NEW = 'NEW';
    static readonly QUEUED = 'QUEUED';
    static readonly SCHEDULED = 'SCHEDULED';
    static readonly RUNNING = 'RUNNING';
    static readonly COMPLETED = 'COMPLETED';
    static readonly FAILED = 'FAILED';

    static isFinished(workflowJob: WorkflowJob): boolean {
        return workflowJob.status === JobStatus.COMPLETED || workflowJob.status === JobStatus.FAILED;
    }

    static isCompleted(workflowJob: WorkflowJob): boolean {
        return workflowJob.status === JobStatus.COMPLETED;
    }
};