import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, Subject, of } from 'rxjs';
import { switchMap, map, zip, share } from 'rxjs/operators';

import { CognitoIdentityCredentials } from 'aws-sdk';
import { AuthenticationDetails, CognitoUserPool, CognitoUser, ICognitoUserPoolData, CognitoUserSession } from 'amazon-cognito-identity-js';

import { ConfigService } from './config.service';

@Injectable()
export class CognitoAuthService {
    private authenticatedSubject = new Subject<CognitoIdentityCredentials>();

    private credentialsSubject = new BehaviorSubject<CognitoIdentityCredentials>(null);
    credentials$ = this.credentialsSubject.asObservable();

    constructor(private configService: ConfigService) {
        this.authenticatedSubject.subscribe(this.credentialsSubject);
    }

    login(userName: string, password: string): Observable<CognitoIdentityCredentials> {
        return this.configService.get<ICognitoUserPoolData>('aws.cognito.userPool').pipe(
            switchMap(cognitoConfig => this.authenticateWithCognito(cognitoConfig, userName, password))
        );
    }

    autoLogin(): Observable<CognitoIdentityCredentials> {
        return this.credentials$.pipe(switchMap(creds => !!creds ? of(creds) : this.login('evanverneyfink', 'mcma-l23#j19%51AKda!')), share());
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
                console.log('failed to get aws creds: ', err);
                this.credentialsSubject.error(err);
            }
            //,
            // newPasswordRequired: (userAttributes, requiredAttributes) => {
            //     console.log('new password required');
            //     cognitoUser.completeNewPasswordChallenge('mcma-l23#j19%51AKda!', requiredAttributes, this.getCognitoAuthCallbacks(cognitoConfig, cognitoUser));
            // }
        };
    };

    private onAuthSuccess(cognitoConfig: ICognitoUserPoolData, session: CognitoUserSession) {
        console.log('auth success');
        
        this.configService.get<string>('aws.cognito.identityPool.id').pipe(
            zip(this.configService.get<string>('aws.region')),
            map(([identityPoolId, region]) => {
                console.log('identity pool id = ' + identityPoolId + ', region = ' + region);
                return new CognitoIdentityCredentials({
                    IdentityPoolId: identityPoolId,
                    Logins: {
                        [`cognito-idp.${region}.amazonaws.com/${cognitoConfig.UserPoolId}`]: session.getIdToken().getJwtToken()
                    }
                }, { region });
            })
        ).subscribe(this.authenticatedSubject);
    }
}