import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { FileInput } from "ngx-material-file-input";

import { MediaWorkflow, MediaWorkflowType } from "@local/model";

import { DialogAssetIngestComponent, DialogUploadComponent } from "../../dialogs";
import { ConfigService, DataService, LoggerService } from "../../services";
import { FormValidationUtils } from "../utils";
import { S3Locator } from "@mcma/aws-s3";
import { zip } from "rxjs";

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
    private config: ConfigService,
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

      zip(
        this.config.get("AwsRegion").pipe(),
        uploadDialogRef.componentInstance.status$,
      ).subscribe(([region, { success, bucket, filesPrefix }]) => {
        DialogUploadComponent.closeDialog(uploadDialogRef);
        if (success) {
          const key = filesPrefix + this.form.get("inputFile")?.value?.files[0]?.name;

          this.logger.info(key);

          const workflow = new MediaWorkflow({
            type: MediaWorkflowType.MediaIngest,
            input: {
              title: this.form.get("title")?.value,
              description: this.form.get("description")?.value,
              inputFile: new S3Locator({
                url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`
              }),
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
