import { Component, Input } from '@angular/core';

import { WorkflowJob } from 'mcma-core';

@Component({
  selector: 'mcma-monitor-detail',
  templateUrl: './monitor-detail.component.html',
  styleUrls: ['./monitor-detail.component.scss']
})
export class MonitorDetailComponent {
  @Input() workflowJob: WorkflowJob;
}
