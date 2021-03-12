import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LoginComponent, NewPasswordChallengeComponent } from "./pages";
import { CognitoAuthGuard } from "./guards";
import { HomeComponent } from "./pages/home/home.component";

const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [CognitoAuthGuard] },
  { path: "new-password-challenge", component: NewPasswordChallengeComponent, canActivate: [CognitoAuthGuard] },
  { path: "home", component: HomeComponent, canActivate: [CognitoAuthGuard]},

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
