import { Component } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import * as passwordGenerator from "generate-password";

import { CognitoAuthService } from "../../services";
import { PasswordErrorStateMatcher } from "../utils";
import { MatStepper } from "@angular/material/stepper";

@Component({
  selector: "app-forgot-password",
  templateUrl: "./forgot-password.component.html",
  styleUrls: ["./forgot-password.component.scss"]
})
export class ForgotPasswordComponent {
  public usernameForm: FormGroup;
  public usernameErrorMessage: string;
  public usernameCompleted: boolean;

  public passwordResetCodeForm: FormGroup;
  public passwordResetCodeErrorMessage: string;
  public passwordResetCodeMedium: string;
  public passwordResetCodeDestination: string;
  public passwordResetCodeCompleted: boolean;

  public setNewPasswordForm: FormGroup;
  public setNewPasswordErrorMessage: string;

  public passwordMatcher: PasswordErrorStateMatcher;

  private tempPassword: string;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private auth: CognitoAuthService
  ) {
    const state = this.router.getCurrentNavigation()?.extras?.state ?? {};
    const username = state.actionData?.username ?? "";

    this.usernameCompleted = false;
    this.usernameErrorMessage = "";
    this.usernameForm = this.fb.group({
      username: [username, Validators.required],
    });

    this.passwordResetCodeCompleted = false;
    this.passwordResetCodeMedium = "";
    this.passwordResetCodeDestination = "";
    this.passwordResetCodeErrorMessage = "";
    this.passwordResetCodeForm = this.fb.group({
      passwordResetCode: ["", Validators.required]
    });

    this.passwordMatcher = new PasswordErrorStateMatcher();

    this.setNewPasswordErrorMessage = "";
    this.setNewPasswordForm = this.fb.group({
      password: ["", Validators.required],
      confirmPassword: [""]
    }, { validators: ForgotPasswordComponent.checkPasswords });

    this.tempPassword = "";
  }

  private static checkPasswords(group: FormGroup) {
    const password = group?.get("password")?.value;
    const confirmPassword = group?.get("confirmPassword")?.value;

    return password === confirmPassword ? null : { notSame: true };
  }

  requestCode(stepper: MatStepper) {
    if (this.usernameForm.valid) {
      const username = this.usernameForm.get("username")?.value;
      this.auth.requestPasswordResetCode(username).subscribe(
        data => {
          this.passwordResetCodeMedium = data.CodeDeliveryDetails?.AttributeName;
          this.passwordResetCodeDestination = data.CodeDeliveryDetails?.Destination;
          this.usernameCompleted = true;
          stepper.next();
        },
        error => {
          this.usernameErrorMessage = error.message;
        });
    }
  }

  submitCode(stepper: MatStepper) {
    if (this.passwordResetCodeForm.valid) {
      const username = this.usernameForm.get("username")?.value;
      const passwordResetCode = this.passwordResetCodeForm.get("passwordResetCode")?.value;

      this.tempPassword = passwordGenerator.generate({
        numbers: true,
        symbols: true,
        lowercase: true,
        uppercase: true,
        strict: true,
      });

      this.auth.submitPasswordResetCode(username, passwordResetCode, this.tempPassword).subscribe(() => {
        this.passwordResetCodeCompleted = true;
        stepper.next();
      });
    }
  }

  submit() {
    this.setNewPasswordErrorMessage = "";

    if (this.setNewPasswordForm.valid) {
      const username = this.usernameForm.get("username")?.value;
      const password = this.setNewPasswordForm.get("password")?.value;

      this.auth.changePassword(username, this.tempPassword, password).subscribe(
        () => {
        },
        error => {
          this.setNewPasswordErrorMessage = error.message;
        });
    }
  }
}
