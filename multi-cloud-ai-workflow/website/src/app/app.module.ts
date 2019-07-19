import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule } from "@angular/common/http";
import { ReactiveFormsModule } from "@angular/forms";

import { MaterialModule } from "./material.module";
import { AppRoutingModule } from "./app-routing.module";

import { ConfigService } from "./services/config.service";
import { S3BucketService } from "./services/s3bucket.service";
import { CognitoAuthService } from "./services/cognito-auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { WorkflowService } from "./services/workflow.service";
import { ModalService } from "./services/modal.service";
import { ContentService } from "./services/content.service";

import { AppComponent } from "./app.component";
import { RunComponent } from "./run/run.component";
import { MonitorComponent } from "./monitor/monitor.component";
import { FileSizePipe } from "./pipes/file-size.pipe";
import { ModalContentDirective } from "./directives/modal-content.directive";
import { ModalComponent } from "./modal/modal.component";
import { RunCompleteModalComponent } from "./run/run-complete-modal/run-complete-modal.component";
import { MonitorDetailComponent } from "./monitor/monitor-detail/monitor-detail.component";
import { MonitorQueueComponent } from "./monitor/monitor-queue/monitor-queue.component";
import { RunMetadataModalComponent } from "./run/run-metadata-modal/run-metadata-modal.component";
import { ServicesComponent } from "./services-page/services.component";
import { McmaClientService } from "./services/mcma-client.service";

@NgModule({
  declarations: [
    ModalContentDirective,
    ModalComponent,
    FileSizePipe,
    AppComponent,
    RunComponent,
    MonitorComponent,
    RunCompleteModalComponent,
    MonitorDetailComponent,
    MonitorQueueComponent,
    RunMetadataModalComponent,
    ServicesComponent
  ],
  entryComponents: [
    RunMetadataModalComponent,
    RunCompleteModalComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    MaterialModule,
    AppRoutingModule
  ],
  providers: [
    ConfigService,
    CognitoAuthService,
    McmaClientService,
    ModalService,
    S3BucketService,
    AuthGuard,
    WorkflowService,
    ContentService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
