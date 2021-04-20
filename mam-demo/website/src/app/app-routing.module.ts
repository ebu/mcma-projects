import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ForgotPasswordComponent, LoginComponent, NewPasswordChallengeComponent } from "./auth";
import { CognitoAuthGuard } from "./guards";
import { AddAssetComponent } from "./pages/add-asset/add-asset.component";
import { WorkflowsComponent } from "./pages/workflows/workflows.component";
import { SettingsComponent } from "./pages/settings/settings.component";
import { BrowseComponent } from "./pages/browse/browse.component";
import { HomeComponent } from "./pages/home/home.component";

const routes: Routes = [
  { path: "login", canActivate: [CognitoAuthGuard], component: LoginComponent },
  { path: "new-password-challenge", canActivate: [CognitoAuthGuard], component: NewPasswordChallengeComponent },
  { path: "forgot-password", canActivate: [CognitoAuthGuard], component: ForgotPasswordComponent },
  {
    path: "", canActivate: [CognitoAuthGuard], component: HomeComponent,
    children: [
      { path: "browse", component: BrowseComponent, canActivate: [CognitoAuthGuard] },
      { path: "add-asset", component: AddAssetComponent, canActivate: [CognitoAuthGuard] },
      { path: "workflows", component: WorkflowsComponent, canActivate: [CognitoAuthGuard] },
      { path: "settings", component: SettingsComponent, canActivate: [CognitoAuthGuard] },

      { path: "**", redirectTo: "add-asset"}
    ]
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    useHash: true
  })],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
