import { Injectable } from '@angular/core';
import { zip, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { ResourceManager, AwsV4Authenticator, AuthenticatorProvider } from 'mcma-core';

import { ConfigService } from './config.service';
import { CognitoAuthService } from './cognito-auth.service';

@Injectable()
export class McmaClientService {

    private resourceManagerSubject = new BehaviorSubject<ResourceManager>(null);
    resourceManager$ = this.resourceManagerSubject.asObservable().pipe(filter(x => !!x));

    constructor(private configService: ConfigService, private cognitoAuthService: CognitoAuthService) {
        zip(
            this.cognitoAuthService.credentials$.pipe(filter(creds => { console.log(creds); return !!creds && !!creds.accessKeyId; })),
            this.configService.get<string>('resourceManager.servicesUrl'),
            this.configService.get<string>('resourceManager.servicesAuthType'),
            this.configService.get<string>('resourceManager.servicesAuthContext'),
            this.configService.get<string>('aws.region')
        ).pipe(
            map(([creds, servicesUrl, servicesAuthType, servicesAuthContext, region]) => {
                const authOptions = {
                    accessKey: creds.accessKeyId,
                    secretKey: creds.secretAccessKey,
                    sessionToken: creds.sessionToken,
                    region: region
                };

                const authenticatorAWS4 = new AwsV4Authenticator(authOptions)

                const authProvider = new AuthenticatorProvider(async (authType, authContext) => {
                    switch (authType) {
                        case "AWS4":
                            return authenticatorAWS4;
                    }
                });

                console.log('creating resource manager', authOptions);
                return { servicesUrl, servicesAuthType, servicesAuthContext, authProvider };
            })
        ).subscribe(config => {
            this.resourceManagerSubject.next(new ResourceManager(config));
        });
    }
}