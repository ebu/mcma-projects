import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { AuthStatus, CognitoAuthActionType, CognitoAuthService, LoggerService } from "./services";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {
  constructor(
    private auth: CognitoAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private logger: LoggerService
  ) {
    auth.status$.subscribe(status => {
      switch (status) {
        case AuthStatus.NotAuthenticated:
          if (route.routeConfig?.path !== "login") {
            this.router.navigate(["login"]);
          }
          break;
        case AuthStatus.ActionRequired:
          const authAction = this.auth.getAuthAction();
          switch (authAction.type) {
            case CognitoAuthActionType.NewPasswordChallenge:
              if (route.routeConfig?.path !== "new-password-challenge") {
                this.router.navigate(["new-password-challenge"]);
              }
              break;
            case CognitoAuthActionType.ForgotPassword:
              if (route.routeConfig?.path !== "forgot-password") {
                this.router.navigate(["forgot-password"], { state: { actionData: authAction.data } });
              }
              break;
            default:
              this.logger.error(`Unexpected authentication action required '${authAction}'`);
              break;
          }
          break;
        case AuthStatus.Authenticated:
          if (route.routeConfig?.path === "login" || route.routeConfig?.path !== "new-password-challenge") {
            this.router.navigate([""]);
          }
          break;
      }
    });
  }
}
