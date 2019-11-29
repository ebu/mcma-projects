import { BMContent } from 'mcma-core';

export class ContentViewModel {
    awsTranscription: string;
    awsTranslation: string;
    awsCelebrities: { selected: any, data: any[] } = { selected: null, data: [] };

    azureTranscription: string;
    azureCelebrities: { selected: any, data: any[] } = { selected: null, data: [] };

    get noData(): boolean {
        return !this.awsTranscription && !this.awsTranslation && this.awsCelebrities.data.length === 0 &&
            !this.azureTranscription && this.azureCelebrities.data.length === 0;
    }

    constructor(public content: BMContent) {
        console.log('creating content vm', content);
        this.populateAwsData();
        this.populateAzureData();
    }

    private populateAwsData(): void {
        if (this.content && this.content.awsAiMetadata) {
            if (this.content.awsAiMetadata.transcription) {
                this.awsTranscription = this.content.awsAiMetadata.transcription.original;
                this.awsTranslation = this.content.awsAiMetadata.transcription.translation;
            }

            const celebsByName: { [key: string]: any } = {};

            if (this.content.awsAiMetadata.celebrities && this.content.awsAiMetadata.celebrities.Celebrities) {
                for (const celebrity of this.content.awsAiMetadata.celebrities.Celebrities) {
                    if (celebrity.Celebrity) {
                        if (!celebsByName[celebrity.Celebrity.Id]) {
                            celebsByName[celebrity.Celebrity.Id] = {
                                id: celebrity.Celebrity.Id,
                                name: celebrity.Celebrity.Name,
                                urls: celebrity.Celebrity.Urls,
                                timestamps: []
                            };
                        }
                        celebsByName[celebrity.Celebrity.Id].timestamps.push({
                            timecode: this.convertToTimeCode(celebrity.Timestamp),
                            seconds: celebrity.Timestamp / 1000
                        });
                    }
                }
            }

            this.awsCelebrities.data = Object.keys(celebsByName).map(k => celebsByName[k]);
            this.awsCelebrities.selected = this.awsCelebrities.data[0];
        }
    }

    private convertToTimeCode(totalMilliseconds: number): string {
        let remaining = totalMilliseconds;
        
        const milliseconds = remaining % 1000;
        remaining -= milliseconds;

        const seconds = (remaining / 1000) % 60;
        remaining -= seconds * 1000;

        const minutes = (remaining / 60000) % 60;
        remaining -= minutes * 60 * 1000;

        const hours = (remaining / 3600000);

        return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${milliseconds}`; 
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