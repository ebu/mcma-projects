import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LoginComponent, NewPasswordChallengeComponent } from "./pages";
import { CognitoAuthGuard } from "./guards";

const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [CognitoAuthGuard] },
  { path: "new-password-challenge", component: NewPasswordChallengeComponent, canActivate: [CognitoAuthGuard] },

  // otherwise redirect to home
  { path: "**", redirectTo: "home" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
