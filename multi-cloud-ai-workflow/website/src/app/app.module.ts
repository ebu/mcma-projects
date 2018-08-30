import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';

import { MaterialModule } from './material.module';
import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { RunComponent } from './run/run.component';
import { MonitorComponent } from './monitor/monitor.component';
import { ConfigService } from './services/config.service';
import { S3BucketService } from './services/s3bucket.service';
import { CognitoAuthService } from './services/cognito-auth.service';
import { AuthGuard } from './guards/auth.guard';
import { FileSizePipe } from './pipes/file-size.pipe';
import { WorkflowService } from './services/workflow.service';
import { MonitorDetailComponent } from './monitor/monitor-detail/monitor-detail.component';
import { MonitorQueueComponent } from './monitor/monitor-queue/monitor-queue.component';

@NgModule({
  declarations: [
    FileSizePipe,
    AppComponent,
    RunComponent,
    MonitorComponent,
    MonitorDetailComponent,
    MonitorQueueComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    MaterialModule,
    AppRoutingModule
  ],
  providers: [
    ConfigService,
    CognitoAuthService,
    S3BucketService,
    AuthGuard,
    WorkflowService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
