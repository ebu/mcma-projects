import { Injectable } from "@angular/core";
import { Observable, BehaviorSubject, Subject, of, from } from "rxjs";
import { switchMap, zip } from "rxjs/operators";

import { CognitoIdentityCredentials } from "aws-sdk";
import { AuthenticationDetails, CognitoUserPool, CognitoUser, ICognitoUserPoolData, CognitoUserSession } from "amazon-cognito-identity-js";

import { ConfigService } from "./config.service";

@Injectable()
export class CognitoAuthService {
    private authenticatedSubject = new Subject<CognitoIdentityCredentials>();

    private credentialsSubject = new BehaviorSubject<CognitoIdentityCredentials>(null);
    credentials$ = this.credentialsSubject.asObservable();

    constructor(private configService: ConfigService) {
        this.authenticatedSubject.subscribe(this.credentialsSubject);
    }

    login(userName: string, password: string): Observable<CognitoIdentityCredentials> {
        console.log("login");
        return this.configService.get<ICognitoUserPoolData>("aws.cognito.userPool").pipe(
            switchMap(cognitoConfig => this.authenticateWithCognito(cognitoConfig, userName, password))
        );
    }

    autoLogin(): Observable<CognitoIdentityCredentials> {
        console.log("autoLogin");
        return this.credentials$.pipe(switchMap(creds => !!creds ? of(creds) : this.login("mcma", "%bshgkUTv*RD$sR7")));
    }

    private authenticateWithCognito(cognitoConfig: ICognitoUserPoolData, userName: string, password: string): Observable<CognitoIdentityCredentials> {
        // create cognito user from config data and user name
        const cognitoUser = new CognitoUser({
            Username: userName,
            Pool: new CognitoUserPool(cognitoConfig)
        });

        cognitoUser.authenticateUser(
            new AuthenticationDetails({ Username: userName, Password: password }),
            this.getCognitoAuthCallbacks(cognitoConfig, cognitoUser));

        return this.authenticatedSubject.asObservable();
    }

    private getCognitoAuthCallbacks(cognitoConfig: ICognitoUserPoolData, cognitoUser: CognitoUser): any {
        return {
            onSuccess: (session: CognitoUserSession) => this.onAuthSuccess(cognitoConfig, session),
            onFailure: (err) => {
                console.log("failed to get aws creds: ", err);
                this.credentialsSubject.error(err);
            }
        };
    };

    private onAuthSuccess(cognitoConfig: ICognitoUserPoolData, session: CognitoUserSession) {
        console.log("auth success");

        this.configService.get<string>("aws.cognito.identityPool.id").pipe(
            zip(this.configService.get<string>("aws.region")),
            switchMap(([identityPoolId, region]) => {
                console.log("identity pool id = " + identityPoolId + ", region = " + region);
                const creds = new CognitoIdentityCredentials({
                    IdentityPoolId: identityPoolId,
                    Logins: {
                        [`cognito-idp.${region}.amazonaws.com/${cognitoConfig.UserPoolId}`]: session.getIdToken().getJwtToken()
                    }
                }, { region });

                return from(creds.getPromise().then(() => creds));
            })
        ).subscribe(this.authenticatedSubject);
    }
}