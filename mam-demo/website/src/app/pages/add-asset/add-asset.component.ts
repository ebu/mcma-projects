import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { FileInput } from "ngx-material-file-input";

import { MediaWorkflow, MediaWorkflowType } from "@local/model";

import { DialogAssetIngestComponent, DialogUploadComponent } from "../../dialogs";
import { DataService, LoggerService } from "../../services";
import { FormValidationUtils } from "../utils";

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
    private data: DataService,
    private logger: LoggerService,
  ) {
    this.form = this.fb.group({
      title: ["", Validators.required],
      description: [""],
      inputFile: ["",
        Validators.compose([
          Validators.required,
          FormValidationUtils.fileExtensions(["mp4", "mxf", "mov"]),
        ])
      ],
    });
  }

  ngOnInit(): void {
  }

  submit() {
    if (this.form.valid) {
      const inputFileInput = this.form.get("inputFile")?.value as FileInput;

      const files: File[] = [];
      files.push(...inputFileInput.files);

      const fileDescriptors = files.map(f => {
        return { path: f.name, file: f };
      });

      const dirname = new Date().toISOString().substring(0, 19).replace(/[:-]/g, "");

      const successDialogRef = DialogAssetIngestComponent.createDialog(this.dialog, true);
      const uploadDialogRef = DialogUploadComponent.createDialog(this.dialog, dirname, fileDescriptors, false);
      uploadDialogRef.componentInstance.status$.subscribe(({ success, bucket, filesPrefix }) => {
        DialogUploadComponent.closeDialog(uploadDialogRef);
        if (success) {
          const inputFileKey = filesPrefix + this.form.get("inputFile")?.value?.files[0]?.name;

          this.logger.info(inputFileKey);

          const workflow = new MediaWorkflow({
            type: MediaWorkflowType.MediaIngest,
            input: {
              title: this.form.get("title")?.value,
              description: this.form.get("description")?.value,
              bucket: bucket,
              inputFile: inputFileKey,
            }
          });

          this.data.createWorkflow(workflow).subscribe(result => {
            this.logger.info(result);
            successDialogRef.afterClosed().subscribe(() => {
              this.router.navigate(["assets"]);
            });
            DialogAssetIngestComponent.showDialog(successDialogRef);
          });
        } else {
          DialogAssetIngestComponent.closeDialog(successDialogRef);
        }
      });
    }
  }
}
