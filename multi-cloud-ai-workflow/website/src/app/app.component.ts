import { Component } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, share } from 'rxjs/operators';

import { CognitoAuthService } from './services/cognito-auth.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})


export class AppComponent {
    isLoggedIn$: Observable<boolean>;

    constructor(private cognitoAuthService: CognitoAuthService) {
        this.isLoggedIn$ = this.cognitoAuthService.autoLogin().pipe(map(creds => !!creds), share());
    }
}
