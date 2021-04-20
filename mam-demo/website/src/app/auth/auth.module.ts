import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ForgotPasswordComponent } from "./forgot-password";
import { LoginComponent } from "./login";
import { NewPasswordChallengeComponent } from "./new-password-challenge";
import { MaterialModule } from "../vendor";
import { ReactiveFormsModule } from "@angular/forms";

const COMPONENTS = [
  ForgotPasswordComponent,
  LoginComponent,
  NewPasswordChallengeComponent,
];

@NgModule({
  declarations: COMPONENTS,
  imports: [
    CommonModule,
    MaterialModule,
    ReactiveFormsModule
  ],
  exports: COMPONENTS
})
export class AuthModule {}
