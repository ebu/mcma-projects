import { ThemePalette } from "@angular/material";

import { WorkflowJob, JobStatus } from "@mcma/core";

import { isCompleted, isFinished } from "../models/job-statuses";

export class WorkflowJobViewModel {
    
    constructor(public workflowJob: WorkflowJob, fakeRunning = false) {
        if (fakeRunning) {
            workflowJob.status = "RUNNING";
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
        return this.workflowJob && !isFinished(this.workflowJob);
    }

    get isFinished(): boolean {
        return this.workflowJob && isFinished(this.workflowJob);
    }

    get isCompleted(): boolean {
        return this.workflowJob && isCompleted(this.workflowJob);
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
            return "";
        }

        if (JobStatus.new.equals(this.workflowJob.status) ||
            JobStatus.queued.equals(this.workflowJob.status) ||
            JobStatus.scheduled.equals(this.workflowJob.status)) {
            return "schedule";
        } else if (JobStatus.running.equals(this.workflowJob.status)) {
            return "play_arrow";
        } else if (JobStatus.completed.equals(this.workflowJob.status)) {
            return "check";
        } else if (JobStatus.failed.equals(this.workflowJob.status)) {
            return "error";
        }
    }

    get statusColor(): ThemePalette {
        if (!this.workflowJob || !this.workflowJob.status) {
            return null;
        }

        if (JobStatus.running.equals(this.workflowJob.status) || JobStatus.completed.equals(this.workflowJob.status)) {
            return "accent";
        } else if (JobStatus.failed.equals(this.workflowJob.status)) {
            return "warn";
        } else {
            return "primary";
        }
    }
}