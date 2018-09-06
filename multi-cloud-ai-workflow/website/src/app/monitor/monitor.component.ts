import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkflowJob } from 'mcma-core';

import { WorkflowService } from '../services/workflow.service';
  
@Component({
  selector: 'mcma-monitor',
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss']
})
export class MonitorComponent implements OnInit {
  workflowJobs$: Observable<WorkflowJob>;

  constructor(private workflowService: WorkflowService) { }

  ngOnInit() {
    this.workflowJobs$ = this.workflowService.getWorkflowJobs();
  }

}
