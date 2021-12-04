import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FilesizePipe } from "./filesize.pipe";

@NgModule({
  declarations: [
    FilesizePipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    FilesizePipe
  ]
})
export class FilesizeModule {}
