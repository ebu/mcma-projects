import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { FormValidationUtils } from "../utils";
import { DialogUploadComponent } from "../../dialogs/dialog-upload/dialog-upload.component";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { DialogAssetIngestComponent } from "../../dialogs/dialog-asset-ingest/dialog-asset-ingest.component";
import { FileInput } from "ngx-material-file-input";

@Component({
  selector: "app-add-asset",
  templateUrl: "./add-asset.component.html",
  styleUrls: ["./add-asset.component.scss"]
})
export class AddAssetComponent implements OnInit {
  public form: FormGroup;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      title: ["", Validators.required],
      description: [""],
      videoFile: ["",
        Validators.compose([
          Validators.required,
          FormValidationUtils.fileExtensions(["mp4", "mxf", "mov"]),
        ])
      ],
      thumbnailFile: ["", FormValidationUtils.fileExtensions(["jpeg", "jpg", "png"])],
      closedCaptionsFile: ["", FormValidationUtils.fileExtensions(["dfxp"])],
      transcriptFile: ["", FormValidationUtils.fileExtensions(["txt"])],
    });
  }

  ngOnInit(): void {
  }

  submit() {
    if (this.form.valid) {
      const videoFileInput = this.form.get("videoFile")?.value as FileInput;

      const files: File[] = [];
      files.push(...videoFileInput.files);

      const fileDescriptors = files.map(f => {
        return { path: f.name, file: f };
      });

      const dirname = new Date().toISOString().substring(0, 19).replace(/[:-]/g, "");

      const successDialogRef = DialogAssetIngestComponent.createDialog(this.dialog, true);
      const uploadDialogRef = DialogUploadComponent.createDialog(this.dialog, dirname, fileDescriptors, false);
      uploadDialogRef.componentInstance.status$.subscribe(({ success, bucket, filesPrefix }) => {
        DialogUploadComponent.closeDialog(uploadDialogRef);
        if (success) {
          const video = filesPrefix + this.form.get("videoFile")?.value?.files[0]?.name;

          successDialogRef.afterClosed().subscribe(() => {
            this.router.navigate(["assets"]);
          });
          DialogAssetIngestComponent.showDialog(successDialogRef);

        } else {
          DialogAssetIngestComponent.closeDialog(successDialogRef);
        }
      });
    }
  }
}
