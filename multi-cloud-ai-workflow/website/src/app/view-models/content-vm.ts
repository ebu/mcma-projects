import { BMContent } from 'mcma-core';
import { McmaClientService } from '../services/mcma-client.service';
import { from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

export class ContentViewModel {
    awsAiMetadata: { transcription: { original, translation, worddiffs } };
    awsTranscription: string;
    awsTranslation: string;
    awsWorddiffs: string;
    awsSpeechToSpeech: { mp4?: string, vtt?: string } = {};
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
            name: '',
            urls: '',
            timestamps: [],
            emotions: [],
            emotionsCleaned: []
        },
        data: []
    };
    azureTranscription: string;
    azureCelebrities: { selected: any, data: any[] } = { selected: null, data: [] };
    azureWorddiffs: string;
    googleAiMetadata: { transcription };
    googleTranscription: string;
    googleWorddiffs: string;

    get noData(): boolean {
        return !this.awsTranscription && !this.awsTranslation && this.awsCelebrities.data.length === 0 &&
            !this.azureTranscription && this.azureCelebrities.data.length === 0;
    }

    constructor(
        public bmContent: BMContent,
        private mcmaClientService: McmaClientService,
        // public http: HttpClient,
    ) {
        console.log('bmContent', bmContent);
        this.populateAwsData();
        this.populateAzureData();
        this.populateGoogleData();
        this.callBMEssences();
    }

    callBMEssences() {
        if (this.bmContent && this.bmContent.bmEssences) {
            const bmEssences = this.bmContent.bmEssences;
            for (const bmEssencesItem of bmEssences) {
                this.getBMEssence(bmEssencesItem);
            }
        }
    }

    getBMEssence(contentUrl: string) {
        this.mcmaClientService.resourceManager$.pipe(
            switchMap(resourceManager => {
                return from(resourceManager.resolve<any>(contentUrl)).pipe(
                    tap(data => {
                        console.log('gotBMEssence: data (tap 1)', data);
                        if (data.title === 'dubbing-srt-output') {
                            this.awsSpeechToSpeech.mp4 = data.locations[0].httpEndpoint;
                        }
                        if (data.title === 'clean_vtt_output_file') {
                            this.awsSpeechToSpeech.vtt = data.locations[0].httpEndpoint;
                        }
                    })
                );
            }),
            tap(data => {
                console.log('gotBMEssence: data (tap 2)', data);
            })
        ).subscribe();
    }

    private populateAwsData(): void {
        if (this.bmContent && this.bmContent.awsAiMetadata) {
            if (this.bmContent.awsAiMetadata.transcription) {
                this.awsTranscription = this.bmContent.awsAiMetadata.transcription.original;
                this.awsTranslation = this.bmContent.awsAiMetadata.transcription.translation;
                this.awsWorddiffs = JSON.parse(this.bmContent.awsAiMetadata.transcription.worddiffs).result;
            }

            const celebsByName: { [key: string]: any } = {};

            const celebritiesEmotions = this.bmContent.awsAiMetadata.celebritiesEmotions;

            if (this.bmContent.awsAiMetadata.celebrities) {
                for (const celebrity of this.bmContent.awsAiMetadata.celebrities) {
                    if (celebrity.Celebrity) {
                        if ( !celebsByName[celebrity.Celebrity.Id]) {
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

            const celebritiesAppearences = Object.keys(celebsByName).map(
                k => celebsByName[k]
            );

            if (celebritiesEmotions !== undefined) {
                for (const celebrityAppearences of celebritiesAppearences) {
                    if (celebritiesEmotions[celebrityAppearences.name]) {
                        celebrityAppearences.emotions = celebritiesEmotions[celebrityAppearences.name];
                    }
                }
            }

            for (const celebritiesAppearencesItem of celebritiesAppearences) {
                if (celebritiesAppearencesItem.emotions !== undefined) {
                    const contentVmAwsCelebritiesItemEmotions = celebritiesAppearencesItem.emotions;
                    const celebritiesEmotionsKeys = Object.keys(contentVmAwsCelebritiesItemEmotions);
                    const celebrityEmotions = [];
                    for (const celebritiesEmotionsObjectItem of celebritiesEmotionsKeys) {
                        if (celebritiesEmotionsObjectItem !== 'counter') {
                            celebrityEmotions.push({
                                'name': celebritiesEmotionsObjectItem,
                                'value': contentVmAwsCelebritiesItemEmotions[celebritiesEmotionsObjectItem]
                            });
                        }
                    }
                    if ( !celebritiesAppearencesItem.emotionsCleaned) {
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
                                if ( !this.azureCelebrities.selected) {
                                    this.azureCelebrities.selected = face;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (this.bmContent && this.bmContent.azureAiMetadata.azureTranscription) {
            this.azureWorddiffs = JSON.parse(this.bmContent.azureAiMetadata.azureTranscription.worddiffs).result;
        }

    }

    private populateGoogleData(): void {

        if (this.bmContent && this.bmContent.googleAiMetadata && this.bmContent.googleAiMetadata.transcription) {
            this.googleTranscription = this.bmContent.googleAiMetadata.transcription;
            console.log(this.googleTranscription);
        }

        if (this.bmContent && this.bmContent.googleAiMetadata.worddiffs) {
            this.googleWorddiffs = JSON.parse(this.bmContent.googleAiMetadata.worddiffs).result;
            console.log(this.googleWorddiffs);
        }

    }

}
