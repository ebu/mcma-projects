import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import { BMContent, HTTP } from 'mcma-core';

@Injectable()
export class ContentService {
    getContent(contentUrl: string): Observable<BMContent> {
        console.log('getting content at ' + contentUrl);
        return from<BMContent>(HTTP.get(contentUrl)).pipe(map(resp => resp.data));
    }
}