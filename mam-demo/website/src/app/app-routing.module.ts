import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LoginComponent, NewPasswordChallengeComponent } from "./pages";
import { CognitoAuthGuard } from "./guards";
import { HomeComponent } from "./pages/home/home.component";
import { ForgotPasswordComponent } from "./pages/forgot-password";

const routes: Routes = [
  { path: "home", component: HomeComponent, canActivate: [CognitoAuthGuard] },
  { path: "login", component: LoginComponent, canActivate: [CognitoAuthGuard] },
  { path: "new-password-challenge", component: NewPasswordChallengeComponent, canActivate: [CognitoAuthGuard] },
  { path: "forgot-password", component: ForgotPasswordComponent, canActivate: [CognitoAuthGuard] },

  // otherwise redirect to home
  { path: "**", redirectTo: "home" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    useHash: true
  })],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
