import { Component, OnInit } from '@angular/core';

import { ModalService } from '../../services/modal.service';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'mcma-run-metadata-modal',
  templateUrl: './run-metadata-modal.component.html',
  styleUrls: ['./run-metadata-modal.component.scss']
})
export class RunMetadataModalComponent implements OnInit {
  private title = new FormControl('');
  private description = new FormControl('');
  form = new FormGroup({ title: this.title, description: this.description });

  constructor(private modalService: ModalService) { }

  ngOnInit() {
  }

  confirm(): void {
    this.modalService.clearModal({ name: this.title.value, description: this.description.value });
  }

  close(): void {
    this.modalService.clearModal();
  }
}
