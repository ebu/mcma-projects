import { Component, Input, Output, EventEmitter } from "@angular/core";
import { PageEvent } from "@angular/material";
import { Observable } from "rxjs";

import { WorkflowJobViewModel } from "../../view-models/workflow-job-vm";

@Component({
    selector: "mcma-monitor-queue",
    styleUrls: ["./monitor-queue.component.scss"],
    templateUrl: "./monitor-queue.component.html",
})
export class MonitorQueueComponent {
  readonly displayedColumns = ["title", "filename", "status"];
  readonly pageSize = 15;

  private curPageNumber = 0;
  private _workflowJobVms: Observable<WorkflowJobViewModel>[];
  curPage: Observable<WorkflowJobViewModel>[];

  selectedJob;

  get workflowJobVms(): Observable<WorkflowJobViewModel>[] { return this._workflowJobVms; }
  @Input() set workflowJobVms(val: Observable<WorkflowJobViewModel>[]) {
    this._workflowJobVms = val;
    if (this._workflowJobVms && this._workflowJobVms.length !== 0) {
      this.setPage(0);
    }
  }

  @Output() jobSelected = new EventEmitter<Observable<WorkflowJobViewModel>>(null);

  onPage(pageEvent: PageEvent): void {
    this.setPage(pageEvent.pageIndex);
  }

  private setPage(pageNumber: number) {
    this.curPageNumber = pageNumber;
    this.curPage = this._workflowJobVms.slice(this.curPageNumber * this.pageSize, (this.curPageNumber * this.pageSize) + this.pageSize);
  }

  selectJob(row) {
      this.selectedJob = row;
      this.jobSelected.emit(row)
  }
}
