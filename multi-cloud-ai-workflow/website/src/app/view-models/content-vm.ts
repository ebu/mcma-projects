import { BMContent } from 'mcma-core';

export class ContentViewModel {
    awsTranscription: string;
    awsTranslation: string;
    awsCelebrities: {
        selected: {
            name,
            urls,
            timestamps: any[],
            emotions: any[],
            emotionsCleaned: any[]
        },
        data: any[]
    } = {
        selected: {
            name: "",
            urls: "",
            timestamps: [],
            emotions: [],
            emotionsCleaned: []
        },
        data: []
    };

    azureTranscription: string;
    azureCelebrities: { selected: any, data: any[] } = {selected: null, data: []};

    get noData(): boolean {
        return !this.awsTranscription && !this.awsTranslation && this.awsCelebrities.data.length === 0 &&
            !this.azureTranscription && this.azureCelebrities.data.length === 0;
    }

    constructor(public bmContent: BMContent) {
        console.log('bmContent', bmContent);
        this.populateAwsData();
        this.populateAzureData();
    }

    private populateAwsData(): void {
        if (this.bmContent && this.bmContent.awsAiMetadata) {
            if (this.bmContent.awsAiMetadata.transcription) {
                this.awsTranscription = this.bmContent.awsAiMetadata.transcription.original;
                this.awsTranslation = this.bmContent.awsAiMetadata.transcription.translation;
            }

            const celebsByName: { [key: string]: any } = {};

            let celebritiesEmotions = this.bmContent.awsAiMetadata.celebritiesEmotions;

            if (this.bmContent.awsAiMetadata.celebrities) {
                for (const celebrity of this.bmContent.awsAiMetadata.celebrities) {
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

            let celebritiesAppearences = Object.keys(celebsByName).map(
                k => celebsByName[k]
            );

            if (celebritiesEmotions != undefined) {
                for (let celebrityAppearences of celebritiesAppearences) {
                    if (celebritiesEmotions[celebrityAppearences.name]) {
                        celebrityAppearences.emotions = celebritiesEmotions[celebrityAppearences.name];
                    }
                }
            }

            for (let celebritiesAppearencesItem of celebritiesAppearences) {
                if (celebritiesAppearencesItem.emotions != undefined) {
                    let contentVmAwsCelebritiesItemEmotions = celebritiesAppearencesItem.emotions;
                    let celebritiesEmotionsKeys = Object.keys(contentVmAwsCelebritiesItemEmotions);
                    let celebrityEmotions = [];
                    for (let celebritiesEmotionsObjectItem of celebritiesEmotionsKeys) {
                        if (celebritiesEmotionsObjectItem != 'counter') {
                            celebrityEmotions.push({'name': celebritiesEmotionsObjectItem, 'value': contentVmAwsCelebritiesItemEmotions[celebritiesEmotionsObjectItem]});
                        }
                    }
                    if (!celebritiesAppearencesItem.emotionsCleaned) {
                        celebritiesAppearencesItem.emotionsCleaned = celebrityEmotions;
                    }
                }

            }

            this.awsCelebrities.data = celebritiesAppearences;
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
        if (this.bmContent && this.bmContent.azureAiMetadata && this.bmContent.azureAiMetadata.videos) {
            for (const video of this.bmContent.azureAiMetadata.videos) {
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
