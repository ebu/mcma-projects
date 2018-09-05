
import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

import { CognitoAuthService } from '../services/cognito-auth.service';

@Injectable()
export class AuthGuard implements CanActivate {

    constructor(private cognitoAuthService: CognitoAuthService) {}
    
    canActivate(): Observable<boolean> {
        return this.cognitoAuthService.autoLogin().pipe(map(creds => !!creds));
    }
}