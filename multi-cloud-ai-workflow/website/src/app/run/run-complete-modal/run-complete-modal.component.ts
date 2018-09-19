import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

import { WorkflowJob } from 'mcma-core';

import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'mcma-run-complete-modal',
  templateUrl: './run-complete-modal.component.html',
  styleUrls: ['./run-complete-modal.component.scss']
})
export class RunCompleteModalComponent {
  @Input() job: WorkflowJob;

  constructor(private modalService: ModalService, private router: Router) { }
  
  close(): void {
    this.modalService.clearModal();
  }

  navigateToWorkflow(): void {
    this.modalService.clearModal();
    this.router.navigate(['monitor']);
  }
}
