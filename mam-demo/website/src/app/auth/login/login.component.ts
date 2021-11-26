import { Component } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { CognitoAuthService, LoggerService } from "../../services";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"]
})
export class LoginComponent {
  public form: FormGroup;
  public loginInvalid: boolean;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private auth: CognitoAuthService,
    private logger: LoggerService
  ) {
    this.loginInvalid = false;

    this.form = this.fb.group({
      username: ["", Validators.required],
      password: ["", Validators.required]
    });
  }

  submit() {
    this.loginInvalid = false;
    if (this.form.valid) {
      const username = this.form.get("username")?.value;
      const password = this.form.get("password")?.value;
      this.auth.login({ username, password }).subscribe(
        () => {
        },
        error => {
          this.logger.error(error);
          this.loginInvalid = true;
        }
      );
    }
  }

  forgotPassword() {
    this.logger.info("Forgot password");
    this.auth.forgotPassword(this.form.get("username")?.value).subscribe();
  }
}
