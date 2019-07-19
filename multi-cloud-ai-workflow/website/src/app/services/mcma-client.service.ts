import { Injectable } from "@angular/core";
import { BehaviorSubject, zip } from "rxjs";
import { filter, map } from "rxjs/operators";

import { ResourceManager, AuthProvider } from "@mcma/client";
import "@mcma/aws-client";

import { ConfigService } from "./config.service";
import { CognitoAuthService } from "./cognito-auth.service";

@Injectable()
export class McmaClientService {

    private resourceManagerSubject = new BehaviorSubject<ResourceManager>(null);
    resourceManager$ = this.resourceManagerSubject.asObservable().pipe(filter(x => !!x));

    constructor(private configService: ConfigService, private cognitoAuthService: CognitoAuthService) {
        zip(
            this.cognitoAuthService.credentials$.pipe(filter(creds => { console.log(creds); return !!creds && !!creds.accessKeyId; })),
            this.configService.get<string>("resourceManager.servicesUrl"),
            this.configService.get<string>("resourceManager.servicesAuthType"),
            this.configService.get<string>("resourceManager.servicesAuthContext"),
            this.configService.get<string>("aws.region")
        ).pipe(
            map(([creds, servicesUrl, servicesAuthType, servicesAuthContext, region]) => {
                const authOptions = {
                    accessKey: creds.accessKeyId,
                    secretKey: creds.secretAccessKey,
                    sessionToken: creds.sessionToken,
                    region: region
                };

                console.log("creating resource manager", authOptions);
                return {
                    config: { servicesUrl, servicesAuthType, servicesAuthContext },
                    authContext: authOptions
                };
            })
        ).subscribe(x => {
            this.resourceManagerSubject.next(new ResourceManager(x.config, new AuthProvider().addAwsV4Auth(x.authContext)));
        });
    }
}