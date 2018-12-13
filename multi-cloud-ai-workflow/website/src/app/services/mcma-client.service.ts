import { Injectable } from '@angular/core';
import { zip, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { ResourceManager, AuthenticatedHttp, AwsV4Authenticator } from 'mcma-core';

import { ConfigService } from './config.service';
import { CognitoAuthService } from './cognito-auth.service';

@Injectable()
export class McmaClientService {
    
    private resourceManagerSubject = new BehaviorSubject<ResourceManager>(null);
    resourceManager$ = this.resourceManagerSubject.asObservable().pipe(filter(x => !!x));
    
    private httpSubject = new BehaviorSubject<AuthenticatedHttp>(null);
    http$ = this.httpSubject.asObservable().pipe(filter(x => !!x));

    constructor(private configService: ConfigService, private cognitoAuthService: CognitoAuthService) {
        zip(
            this.cognitoAuthService.credentials$.pipe(filter(creds => { console.log(creds); return !!creds && !!creds.accessKeyId; })),
            this.configService.get<string>('servicesUrl'),
            this.configService.get<string>('aws.region')
        ).pipe(
            map(([creds, servicesUrl, region]) => {
                const authOptions = {
                    accessKey: creds.accessKeyId,
                    secretKey: creds.secretAccessKey,
                    sessionToken: creds.sessionToken,
                    region: region
                };
                console.log('creating resource manager', authOptions);
                return { servicesUrl, authenticator: new AwsV4Authenticator(authOptions) };
            })
        ).subscribe(x => {
            console.log('emitting resource manager and authenticated http');
            this.resourceManagerSubject.next(new ResourceManager(x.servicesUrl, x.authenticator));
            this.httpSubject.next(new AuthenticatedHttp(x.authenticator));
        });
    }
}