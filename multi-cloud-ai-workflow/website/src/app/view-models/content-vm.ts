import { BMContent } from 'mcma-core';

export class ContentViewModel {
    awsTranscription: string;
    awsTranslation: string;

    azureCelebrities: { selected: any, data: any[] } = { selected: null, data: [] };
    azureTranscription: string;

    constructor(public content: BMContent) {
        this.populateAwsData();
        this.populateAzureData();
    }

    private populateAwsData(): void {
        if (this.content && this.content.awsAiMetadata && this.content.awsAiMetadata.transcription) {
            this.awsTranscription = this.content.awsAiMetadata.transcription.original;
            this.awsTranslation = this.content.awsAiMetadata.transcription.translation;
        }
    }

    private populateAzureData(): void {
        if (this.content && this.content.azureAiMetadata && this.content.azureAiMetadata.videos) {
            for (const video of this.content.azureAiMetadata.videos) {
                if (video.insights) {
                    if (video.insights.transcript) {
                        this.azureTranscription = '';
                        for (const transcript of video.insights.transcript) {
                            if (transcript.text) {
                                this.azureTranscription += transcript.text + ' ';
                            }
                        }
                        this.azureTranscription.trim();
                    }

                    if (video.insights.faces) {
                        for (const face of video.insights.faces) {
                            if (face.imageUrl) {
                                this.azureCelebrities.data.push(face);
                                if (!this.azureCelebrities.selected) {
                                    this.azureCelebrities.selected = face;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}