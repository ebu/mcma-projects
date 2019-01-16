import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, timer } from 'rxjs';
import { map, concatMap, takeWhile, switchMap, tap } from 'rxjs/operators';

import { BMContent } from 'mcma-core';
import { McmaClientService } from './mcma-client.service';
import { ContentViewModel } from '../view-models/content-vm';

@Injectable()
export class ContentService {
    constructor(private mcmaClientService: McmaClientService) {}

    getContent(contentUrl: string): Observable<BMContent> {
        //console.log('getting content at ' + contentUrl);
        return this.mcmaClientService.resourceManager$.pipe(
            switchMap(resourceManager => {
                console.log('using auth http to get content at ' + contentUrl);
                return from<BMContent>(resourceManager.resolve(contentUrl)).pipe(
                    tap(data => {
                        console.log('got content (tap 1)', data);
                    })
                );
            }),
            tap(data => {
                console.log('got content (tap 2)', data);
            })
        );
    }

    pollUntil(bmContentId: string, stopPolling: Observable<boolean>): Observable<ContentViewModel> {
        const subject = new BehaviorSubject<ContentViewModel>(null);

        // subscribe to observable indicating when to stop polling
        let stop = false;
        const stopSub = stopPolling.subscribe(val => {
            if (val) {
                stop = true;
                stopSub.unsubscribe();
            }
        });
        
        // poll until completion, emitting every 3 secs until the job is completed
        // when the job completes, unsubscribe from polling and load it one more time
        const sub1 =
            timer(0, 3000).pipe(
                switchMap(() => this.mcmaClientService.resourceManager$),
                switchMap(resourceManager => from<BMContent>(resourceManager.resolve(bmContentId))),
                takeWhile(() => !stop)
            ).subscribe(
                content => {
                    console.log('finished polling content', content);
                    subject.next(new ContentViewModel(content));
                },
                err => subject.error(err),
                () => {
                    // unsubscribe from polling
                    sub1.unsubscribe();
                    // get finished job data
                    const sub2 = this.getContent(bmContentId).subscribe(
                        bmContent => {
                            console.log('emitting content vm', bmContent);
                            subject.next(new ContentViewModel(bmContent));
                        },
                        err => {
                            console.log('failed to get content vm');
                            subject.error(err);
                        },
                        () => {
                            console.log('unsubscribing from final content get');
                            sub2.unsubscribe();
                        });
                }
            );

        return subject.asObservable();
    }
}