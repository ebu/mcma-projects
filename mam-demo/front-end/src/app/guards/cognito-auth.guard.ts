import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { CognitoAuthService, CognitoAuthStatus } from "../services";

@Injectable({
  providedIn: "root"
})
export class CognitoAuthGuard implements CanActivate {
  constructor(public auth: CognitoAuthService, public router: Router) {
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> {

    return this.auth.status$.pipe(
      map(authStatus => {
        if (authStatus === CognitoAuthStatus.NotAuthenticated && route?.routeConfig?.path !== "login") {
          this.router.navigate(["login"]);
          return false;
        } else if (authStatus === CognitoAuthStatus.MustCompleteNewPasswordChallenge && route?.routeConfig?.path !== "new-password-challenge") {
          this.router.navigate(["new-password-challenge"]);
          return false;
        } else if (authStatus === CognitoAuthStatus.Authenticated && (route?.routeConfig?.path === "login" || route?.routeConfig?.path === "new-password-challenge")) {
          this.router.navigate([""]);
          return false;
        }

        return true;
      })
    );
  }
}
