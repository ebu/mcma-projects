import {Component, Input} from '@angular/core';

import { WorkflowJob } from 'mcma-core';

@Component({
  selector: 'monitor-queue',
  styleUrls: ['./monitor-queue.component.scss'],
  templateUrl: './monitor-queue.component.html',
})
export class MonitorQueueComponent {
  readonly displayedColumns = ['title', 'description', 'filename', 'progress', 'status'];

  @Input() workflowJobs: WorkflowJob[];
}
