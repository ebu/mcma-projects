import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

import { WorkflowJob } from 'mcma-core';

import { WorkflowService } from '../services/workflow.service';
  
@Component({
  selector: 'mcma-monitor',
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss']
})
export class MonitorComponent implements OnInit {
  workflowJobs$: Observable<WorkflowJob>;

  private selectedWorkflowJobSubject = new BehaviorSubject<WorkflowJob>(null);
  selectedWorkflowJob$ = this.selectedWorkflowJobSubject.asObservable();

  constructor(private workflowService: WorkflowService) { }

  ngOnInit() {
    this.workflowJobs$ =
      this.workflowService.getWorkflowJobs().pipe(
        tap(jobs => {
          if (jobs && jobs.length > 0) {
            this.selectedWorkflowJobSubject.next(jobs[0]);
          }
        }));
  }

  onJobSelected(workflowJob: WorkflowJob): void {
    this.selectedWorkflowJobSubject.next(workflowJob);
  }
}
