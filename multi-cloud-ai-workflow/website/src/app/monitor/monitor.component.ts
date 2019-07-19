import { Component, OnInit } from "@angular/core";
import { Observable, of } from "rxjs";
import { tap, map } from "rxjs/operators";

import { isFinished } from "../models/job-statuses";
import { WorkflowService } from "../services/workflow.service";
import { WorkflowJobViewModel } from "../view-models/workflow-job-vm";
  
@Component({
    selector: "mcma-monitor",
    templateUrl: "./monitor.component.html",
    styleUrls: ["./monitor.component.scss"]
})
export class MonitorComponent implements OnInit {
  workflowJobVms$: Observable<Observable<WorkflowJobViewModel>[]>;
  selectedWorkflowJobVm$: Observable<WorkflowJobViewModel>;

  constructor(private workflowService: WorkflowService) { }

  ngOnInit(): void {
    this.refresh();
  }
  
  refresh(): void {
    this.workflowJobVms$ =
      this.workflowService.getWorkflowJobs().pipe(
        map(jobs =>
          jobs.map(j =>
            !isFinished(j)
              ? this.workflowService.pollForCompletion(j.id)
              : of(new WorkflowJobViewModel(j)))),
        tap(jobs => {
          if (jobs && jobs.length > 0) {
            this.selectedWorkflowJobVm$ = jobs[0];
          }
        }));
  }

  onJobSelected(workflowJob: Observable<WorkflowJobViewModel>): void {
    this.selectedWorkflowJobVm$ = workflowJob;
  }
}
