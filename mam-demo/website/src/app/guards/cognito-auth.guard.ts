import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { AuthStatus, CognitoAuthActionType, CognitoAuthService, LoggerService } from "../services";

@Injectable({
  providedIn: "root"
})
export class CognitoAuthGuard implements CanActivate {
  constructor(
    public auth: CognitoAuthService,
    public router: Router,
    public logger: LoggerService,
  ) {
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> {

    return this.auth.status$.pipe(
      map(authStatus => {
        if (authStatus === AuthStatus.NotAuthenticated && route?.routeConfig?.path !== "login") {
          this.router.navigate(["login"]);
          return false;
        } else if (authStatus === AuthStatus.ActionRequired) {
          const authAction = this.auth.getAuthAction();
          switch (authAction.type) {
            case CognitoAuthActionType.NewPasswordChallenge:
              if (route?.routeConfig?.path !== "new-password-challenge") {
                this.router.navigate(["new-password-challenge"]);
                return false;
              }
              break;
            case CognitoAuthActionType.ForgotPassword:
              if (route?.routeConfig?.path !== "forgot-password") {
                this.router.navigate(["forgot-password"], { state: { actionData: authAction.data } });
                return false;
              }
              break;
            default:
              this.logger.error(`Unexpected authentication action required '${authAction}'`);
              return false;
          }
        } else if (authStatus === AuthStatus.Authenticated && (route?.routeConfig?.path === "login" || route?.routeConfig?.path === "new-password-challenge" || route?.routeConfig?.path === "forgot-password")) {
          this.router.navigate([""]);
          return false;
        }

        return true;
      })
    );
  }
}
