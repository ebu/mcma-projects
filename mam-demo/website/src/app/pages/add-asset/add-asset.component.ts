import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { FormValidationUtils } from "../utils";
import { DialogUploadComponent } from "../../dialogs/dialog-upload/dialog-upload.component";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { DialogAssetIngestComponent } from "../../dialogs/dialog-asset-ingest/dialog-asset-ingest.component";
import { FileInput } from "../../vendor/material-file-input/model/file-input.model";

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
      const thumbnailFileInput = this.form.get("thumbnailFile")?.value as FileInput;
      const closedCaptionsFileInput = this.form.get("closedCaptionsFile")?.value as FileInput;
      const transcriptFileInput = this.form.get("transcriptFile")?.value as FileInput;

      const files: File[] = [];
      files.push(...videoFileInput.files);
      if (thumbnailFileInput) {
        files.push(...thumbnailFileInput.files);
      }
      if (closedCaptionsFileInput) {
        files.push(...closedCaptionsFileInput.files);
      }
      if (transcriptFileInput) {
        files.push(...transcriptFileInput.files);
      }

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

          let thumbnail, closedCaptions, transcript;
          if (this.form.get("thumbnailFile")?.value?.files?.length) {
            thumbnail = filesPrefix + this.form.get("thumbnailFile")?.value?.files[0]?.name;
          }
          if (this.form.get("closedCaptionsFile")?.value?.files?.length) {
            closedCaptions = filesPrefix + this.form.get("closedCaptionsFile")?.value?.files[0]?.name;
          }
          if (this.form.get("transcriptFile")?.value?.files?.length) {
            transcript = filesPrefix + this.form.get("transcriptFile")?.value?.files[0]?.name;
          }

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
