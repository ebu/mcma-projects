import { ThemePalette } from '@angular/material';

import { WorkflowJob } from 'mcma-core';

import { JobStatus } from '../models/job-statuses';

export class WorkflowJobViewModel {
    
    constructor(public workflowJob: WorkflowJob, fakeRunning = false) {
        if (fakeRunning) {
            workflowJob.status = 'RUNNING';
        }
    }

    get fileName(): string {
        return this.workflowJob && this.workflowJob.jobInput && this.workflowJob.jobInput.inputFile
            ? this.workflowJob.jobInput.inputFile.awsS3Key
            : null;
    }

    get title(): string {
        return this.workflowJob && this.workflowJob.jobInput && this.workflowJob.jobInput.metadata
            ? this.workflowJob.jobInput.metadata.name
            : null;
    }

    get description(): string {
        return this.workflowJob && this.workflowJob.jobInput && this.workflowJob.jobInput.metadata
            ? this.workflowJob.jobInput.metadata.description
            : null;
    }

    get isRunning(): boolean {
        return this.workflowJob && !JobStatus.isFinished(this.workflowJob);
    }

    get isFinished(): boolean {
        return this.workflowJob && JobStatus.isFinished(this.workflowJob);
    }

    get isCompleted(): boolean {
        return this.workflowJob && JobStatus.isCompleted(this.workflowJob);
    }

    get previewUrl(): string {
        return this.workflowJob && this.workflowJob.jobOutput && this.workflowJob.jobOutput.websiteMediaFile
            ? this.workflowJob.jobOutput.websiteMediaFile.httpEndpoint
            : null;
    }

    get aiJobUrl(): string {
        return this.workflowJob && this.workflowJob.jobOutput ? this.workflowJob.jobOutput.aiWorkflow : null;
    }

    get contentUrl(): string {
        return this.workflowJob && this.workflowJob.jobOutput ? this.workflowJob.jobOutput.bmContent : null;
    }

    get statusIcon(): string {
        if (!this.workflowJob || !this.workflowJob.status) {
            return '';
        }

        switch (this.workflowJob.status) {
            case JobStatus.NEW:
            case JobStatus.QUEUED:
            case JobStatus.SCHEDULED:
                return 'schedule';
            case JobStatus.RUNNING:
                return 'play_arrow';
            case JobStatus.COMPLETED:
                return 'check';
            case JobStatus.FAILED:
                return 'error';
        }
    }

    get statusColor(): ThemePalette {
        if (!this.workflowJob || !this.workflowJob.status) {
            return null;
        }

        switch (this.workflowJob.status) {
            case JobStatus.RUNNING:
            case JobStatus.COMPLETED:
                return 'accent';
            case JobStatus.FAILED:
                return 'warn';
            default:
                return 'primary';
        }
    }
}