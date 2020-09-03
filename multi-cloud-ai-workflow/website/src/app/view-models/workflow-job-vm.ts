import { ThemePalette } from "@angular/material/core";
import { JobStatus, WorkflowJob } from "@mcma/core";

import { isCompleted, isFinished } from "../models/job-statuses";

export class WorkflowJobViewModel {

    constructor(public workflowJob: WorkflowJob, fakeRunning = false) {
        if (fakeRunning) {
            workflowJob.status = "RUNNING";
        }
    }

    get fileName(): string {
        return this.workflowJob?.jobInput?.inputFile
            ? this.workflowJob.jobInput.inputFile.key
            : null;
    }

    get title(): string {
        return this.workflowJob?.jobInput?.metadata
            ? this.workflowJob.jobInput.metadata.name
            : null;
    }

    get description(): string {
        return this.workflowJob?.jobInput?.metadata
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
        return this.workflowJob?.jobOutput?.websiteMediaFile
            ? this.workflowJob.jobOutput.websiteMediaFile.url
            : null;
    }

    get aiJobUrl(): string {
        return this.workflowJob?.jobOutput?.aiWorkflow ?? null;
    }

    get contentUrl(): string {
        return this.workflowJob?.jobOutput?.bmContent ?? null;
    }

    get statusIcon(): string {
        if (!this.workflowJob || !this.workflowJob.status) {
            return "";
        }

        if (JobStatus.New.toLowerCase() === this.workflowJob.status.toLowerCase() ||
            JobStatus.Queued.toLowerCase() === this.workflowJob.status.toLowerCase() ||
            JobStatus.Scheduled.toLowerCase() === this.workflowJob.status.toLowerCase()) {
            return "schedule";
        } else if (JobStatus.Running.toLowerCase() === this.workflowJob.status.toLowerCase()) {
            return "play_arrow";
        } else if (JobStatus.Completed.toLowerCase() === this.workflowJob.status.toLowerCase()) {
            return "check";
        } else if (JobStatus.Failed.toLowerCase() === this.workflowJob.status.toLowerCase()) {
            return "error";
        }
    }

    get statusColor(): ThemePalette {
        if (!this.workflowJob || !this.workflowJob.status) {
            return null;
        }

        if (JobStatus.Running.toLowerCase() === this.workflowJob.status.toLowerCase() ||
            JobStatus.Completed.toLowerCase() === this.workflowJob.status.toLowerCase()) {
            return "accent";
        } else if (JobStatus.Failed.toLowerCase() === this.workflowJob.status.toLowerCase()) {
            return "warn";
        } else {
            return "primary";
        }
    }
}
