import { Component } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";

import { ModalService } from "../../services/modal.service";

@Component({
  selector: "mcma-run-metadata-modal",
  templateUrl: "./run-metadata-modal.component.html",
  styleUrls: ["./run-metadata-modal.component.scss"]
})
export class RunMetadataModalComponent {
  private title = new FormControl("");
  private description = new FormControl("");
  form = new FormGroup({ title: this.title, description: this.description });

  constructor(private modalService: ModalService) { }

  confirm(): void {
    this.modalService.clearModal({ name: this.title.value, description: this.description.value });
  }

  close(): void {
    this.modalService.clearModal();
  }
}
