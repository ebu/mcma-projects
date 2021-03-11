import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { CognitoAuthService, CognitoAuthStatus } from "./services"
import { User } from "./model"

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {
  authenticated: boolean;
  user: User | null;

  constructor(private auth: CognitoAuthService, private router: Router) {
    this.authenticated = false;
    this.user = null;

    auth.status$.subscribe(status => {
      this.authenticated = status === CognitoAuthStatus.Authenticated;
      this.user = auth.getUser();
      switch (status) {
        case CognitoAuthStatus.NotAuthenticated:
          this.router.navigate(["login"]);
          break;
        case CognitoAuthStatus.MustCompleteNewPasswordChallenge:
          this.router.navigate(["change-password"]);
          break;
        case CognitoAuthStatus.Authenticated:
          this.router.navigate([""]);
          break;
      }
    });
  }

  logout() {
    this.auth.logout().subscribe();
  }
}
