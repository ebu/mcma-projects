import { Component, Input, OnInit, OnChanges } from '@angular/core';

import { WorkflowJob } from 'mcma-core';
import { timeout } from 'q';

const MCMA_CORE = require('mcma-core');

@Component({
    selector: 'mcma-monitor-detail',
    templateUrl: './monitor-detail.component.html',
    styleUrls: ['./monitor-detail.component.scss']
})
export class MonitorDetailComponent implements OnChanges {
    @Input() workflowJob: WorkflowJob;

    mediaFileUrl: string = "";

    aiWorkflowJobStatus: string = "";
    transcription: string = "";
    translation: string = "";

    ngOnChanges() {
        this.aiWorkflowJobStatus = "Unknown";
        this.transcription = "";
        this.translation = "";

        if (this.workflowJob &&
            this.workflowJob.jobOutput &&
            this.workflowJob.jobOutput.websiteMediaFile &&
            this.workflowJob.jobOutput.websiteMediaFile.httpEndpoint) {
            this.mediaFileUrl = this.workflowJob.jobOutput.websiteMediaFile.httpEndpoint;
            this.loadAiData(this.workflowJob.id);
        } else {
            this.mediaFileUrl = "";
        }
    }

    private loadAiData = async (conformWorkflowId) => {
        if (this.workflowJob.id !== conformWorkflowId) {
            return;
        }

        try {
            let aiWorkflowId = this.workflowJob.jobOutput.aiWorkflow;
            let bmContentId = this.workflowJob.jobOutput.bmContent;

            let response = await MCMA_CORE.HTTP.get(aiWorkflowId);
            let aiWorkflowJob = response.data;

            let isDone = (aiWorkflowJob.status === "COMPLETED" || aiWorkflowJob.status === "FAILED");

            switch (aiWorkflowJob.status) {
                case "NEW":
                case "QUEUED":
                    this.aiWorkflowJobStatus = "Queued";
                    break;
                case "SCHEDULED":
                    this.aiWorkflowJobStatus = "Scheduled";
                    break;
                case "RUNNING":
                    this.aiWorkflowJobStatus = "Processing";
                    break;
                case "COMPLETED":
                    this.aiWorkflowJobStatus = "Completed";
                    break;
                case "FAILED":
                    this.aiWorkflowJobStatus = "Failed";
                    break;
            }

            response = await MCMA_CORE.HTTP.get(bmContentId);
            let bmContent = response.data;

            let defaultMessage = !isDone ? "Waiting for results" : "No results";

            if (bmContent &&
                bmContent.awsAiMetadata &&
                bmContent.awsAiMetadata.transcription) {

                if (bmContent.awsAiMetadata.transcription.original) {
                    this.transcription = bmContent.awsAiMetadata.transcription.original;
                } else {
                    this.transcription = defaultMessage;
                }

                if (bmContent.awsAiMetadata.transcription.translation) {
                    this.translation = bmContent.awsAiMetadata.transcription.translation;
                } else {
                    this.translation = defaultMessage;
                }
            } else {
                this.transcription = defaultMessage;
                this.translation = defaultMessage;
            }

            if (!isDone) {
                window.setTimeout(() => this.loadAiData(conformWorkflowId), 3000);
            }
        } catch (error) {
            this.transcription = "Error while retrieving data";
            this.translation = "Error while retrieving data";
            console.log("Failed to retrieve data");
        }
    }
}
