import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, map, tap, share } from 'rxjs/operators';

@Injectable()
export class ConfigService {
    private configLoadSubject = new BehaviorSubject(null);
    private configLoad$ = this.configLoadSubject.asObservable().pipe(switchMap(x => !!x ? of(x) : this.loadConfig()));

    constructor(private httpClient: HttpClient) {}

    get<T>(key: string, defaultVal: T = null): Observable<T> {
        return this.configLoad$.pipe(
            map(c => {
                console.log('getting config for key ' + key);
                let val = c;
                for (let keyPart of key.split('.')) {
                    if (!val.hasOwnProperty(keyPart)) {
                        return defaultVal;
                    }
                    val = val[keyPart];
                }
                console.log('config for key ' + key, val);
                return val;
            })
        );
    }

    private loadConfig(): Observable<any> {
        return this.httpClient.get('config.json').pipe(tap(resp => this.configLoadSubject.next(resp)));
    }
}