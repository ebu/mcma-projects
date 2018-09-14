import { Component, Input, OnInit, OnChanges, ModuleWithComponentFactories, ViewChild, ElementRef } from '@angular/core';

import { WorkflowJob } from 'mcma-core';

const MCMA_CORE = require('mcma-core');

@Component({
    selector: 'mcma-monitor-detail',
    templateUrl: './monitor-detail.component.html',
    styleUrls: ['./monitor-detail.component.scss']
})
export class MonitorDetailComponent implements OnChanges {
    @Input() workflowJob: WorkflowJob;

    @ViewChild("videoElement")
    private videoElementRef: ElementRef;

    mediaFileUrl: string = "";

    aiWorkflowJobStatus: string = "";

    awsTranscription: string = "";
    awsTranslation: string = "";

    azureTranscription: string = "";
    azureCelebrities = [];
    celebrityColumns = ['name'];
    selectedAzureCelebrity: any = {};

    ngOnChanges() {
        this.aiWorkflowJobStatus = "Unknown";
        this.awsTranscription = "";
        this.awsTranslation = "";

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

            this.awsTranscription = defaultMessage;
            this.awsTranslation = defaultMessage;
            this.azureTranscription = defaultMessage;

            if (bmContent &&
                bmContent.awsAiMetadata &&
                bmContent.awsAiMetadata.transcription) {

                if (bmContent.awsAiMetadata.transcription.original) {
                    this.awsTranscription = bmContent.awsAiMetadata.transcription.original;
                }
                if (bmContent.awsAiMetadata.transcription.translation) {
                    this.awsTranslation = bmContent.awsAiMetadata.transcription.translation;
                }
            }

            let celebrities = [];

            if (bmContent &&
                bmContent.azureAiMetadata) {
                const data = bmContent.azureAiMetadata;
                if (data.videos) {
                    for (const video of data.videos) {
                        if (video.insights) {
                            if (video.insights.transcript) {

                                let azureTranscription = "";

                                for (const transcript of video.insights.transcript) {
                                    if (transcript.text) {
                                        azureTranscription += transcript.text + " ";
                                    }
                                }

                                this.azureTranscription = this.azureTranscription.trim();

                                if (azureTranscription) {
                                    this.azureTranscription = azureTranscription;
                                }
                            }

                            if (video.insights.faces) {
                                for (const face of video.insights.faces) {
                                    if (face.imageUrl) {
                                        celebrities.push(face);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let selectedAzureCelebrity = this.selectedAzureCelebrity;
            this.selectedAzureCelebrity = {};

            this.azureCelebrities = celebrities;

            for (const celebrity of celebrities) {
                if (celebrity.imageUrl === selectedAzureCelebrity.imageUrl) {
                    this.selectedAzureCelebrity = celebrity;
                }
            }

            if (!this.selectedAzureCelebrity.imageUrl && celebrities.length) {
                this.selectedAzureCelebrity = celebrities[0];
            }

            if (!isDone) {
                window.setTimeout(() => this.loadAiData(conformWorkflowId), 5000);
            }
        } catch (error) {
            this.awsTranscription = "Error while retrieving data";
            this.awsTranslation = "Error while retrieving data";
            console.log("Failed to retrieve data");
        }
    }

    selectAzureCelebrity(row) {
        console.log(row);
        this.selectedAzureCelebrity = row;
    }

    seekVideoAzure(instance) {
        console.log(instance);

        let time = instance.start;
        let timeParts = time.split(":");

        let timeSeconds = 0;

        for (const timePart of timeParts) {
            let parsed = Number.parseFloat(timePart);
            timeSeconds *= 60;
            timeSeconds += parsed;
        }

        this.videoElementRef.nativeElement.currentTime = timeSeconds;
    }
}
