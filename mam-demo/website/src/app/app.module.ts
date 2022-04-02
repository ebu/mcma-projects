import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule } from "@angular/common/http";
import { ReactiveFormsModule } from "@angular/forms";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { MaterialModule } from "./vendor";
import { BrowseComponent } from "./pages/browse/browse.component";
import { AddAssetComponent } from "./pages/add-asset/add-asset.component";
import { WorkflowsComponent } from "./pages/workflows/workflows.component";
import { SettingsComponent } from "./pages/settings/settings.component";
import { HomeComponent } from "./pages/home/home.component";
import { DialogsModule } from "./dialogs/dialogs.module";
import { httpInterceptorProviders } from "./http-interceptors";
import { AssetComponent } from './pages/asset/asset.component';

@NgModule({
  declarations: [
    AppComponent,
    BrowseComponent,
    AddAssetComponent,
    WorkflowsComponent,
    SettingsComponent,
    HomeComponent,
    AssetComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    BrowserModule,
    DialogsModule,
    HttpClientModule,
    MaterialModule,
    ReactiveFormsModule
  ],
  providers: [
    httpInterceptorProviders
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
