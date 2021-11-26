import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MaterialModule } from "../vendor";
import { FilesizeModule } from "../pipes";

import { DialogAssetIngestComponent } from './dialog-asset-ingest/dialog-asset-ingest.component';
import { DialogUploadComponent } from "./dialog-upload/dialog-upload.component";

@NgModule({
  declarations: [
    DialogAssetIngestComponent,
    DialogUploadComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FilesizeModule,
  ],
  exports: [
    DialogUploadComponent,
    DialogAssetIngestComponent,
  ]
})
export class DialogsModule {}
