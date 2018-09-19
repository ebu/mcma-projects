import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, timer } from 'rxjs';
import { map, concatMap, takeWhile } from 'rxjs/operators';

import { BMContent, HTTP } from 'mcma-core';
import { ContentViewModel } from '../view-models/content-vm';

@Injectable()
export class ContentService {
    getContent(contentUrl: string): Observable<BMContent> {
        console.log('getting content at ' + contentUrl);
        return from<BMContent>(HTTP.get(contentUrl)).pipe(map(resp => resp.data));
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
                concatMap(() => from<BMContent>(HTTP.get(bmContentId))),
                map(resp => resp.data),
                takeWhile(() => !stop)
            ).subscribe(
                job => subject.next(new ContentViewModel(job)),
                err => subject.error(err),
                () => {
                    // unsubscribe from polling
                    sub1.unsubscribe();
                    // get finished job data
                    const sub2 = from<BMContent>(HTTP.get(bmContentId)).subscribe(
                        resp => subject.next(new ContentViewModel(resp.data)),
                        err => subject.error(err),
                        () => sub2.unsubscribe());
                }
            );

        return subject.asObservable();
    }
}