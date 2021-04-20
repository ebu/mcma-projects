import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { FormValidationUtils } from "../utils";

@Component({
  selector: "app-add-asset",
  templateUrl: "./add-asset.component.html",
  styleUrls: ["./add-asset.component.scss"]
})
export class AddAssetComponent implements OnInit {
  public form: FormGroup;

  constructor(private fb: FormBuilder) {
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

    }
  }
}
