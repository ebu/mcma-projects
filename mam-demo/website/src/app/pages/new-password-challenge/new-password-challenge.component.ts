import { Component } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from "@angular/forms";
import { ErrorStateMatcher } from "@angular/material/core";
import { Router } from "@angular/router";

import { CognitoAuthService } from "../../services";

@Component({
  selector: "app-new-password-challenge",
  templateUrl: "./new-password-challenge.component.html",
  styleUrls: ["./new-password-challenge.component.scss"]
})
export class NewPasswordChallengeComponent {
  public form: FormGroup;
  public errorMessage: string;

  public passwordMatcher: PasswordErrorStateMatcher;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: CognitoAuthService
  ) {
    this.errorMessage = "";
    this.passwordMatcher = new PasswordErrorStateMatcher();

    this.form = this.fb.group({
      password: ["", Validators.required],
      confirmPassword: [""]
    }, { validators: NewPasswordChallengeComponent.checkPasswords });
  }

  private static checkPasswords(group: FormGroup) {
    const password = group?.get("password")?.value;
    const confirmPassword = group?.get("confirmPassword")?.value;

    return password === confirmPassword ? null : { notSame: true };
  }

  submit() {
    this.errorMessage = "";

    if (this.form.valid) {
      const password = this.form.get("password")?.value;

      this.authService.completeNewPasswordChallenge(password).subscribe(
        () => {
        },
        error => {
          this.errorMessage = error.message;
        });
    }
  }
}

export class PasswordErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const invalidCtrl = !!(control?.invalid && control?.parent?.dirty);
    const invalidParent = !!(control?.parent?.invalid && control?.parent?.dirty);

    return invalidCtrl || invalidParent;
  }
}
