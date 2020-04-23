import { Component, OnInit } from "@angular/core";
import { Observable, of, zip } from "rxjs";
import { map, tap } from "rxjs/operators";

import { WorkflowService } from "../services/workflow.service";
import { ConfigService } from "../services/config.service";
import { isFinished } from "../models/job-statuses";
import { WorkflowJobViewModel } from "../view-models/workflow-job-vm";

@Component({
    selector: "mcma-monitor",
    templateUrl: "./monitor.component.html",
    styleUrls: ["./monitor.component.scss"]
})
export class MonitorComponent implements OnInit {
    workflowJobVms$: Observable<Observable<WorkflowJobViewModel>[]>;
    selectedWorkflowJobVm$: Observable<WorkflowJobViewModel>;

    constructor(private workflowService: WorkflowService, private configService: ConfigService) {
    }

    ngOnInit(): void {
        this.refresh();
    }

    refresh(): void {
        this.workflowJobVms$ =
            zip(
                this.workflowService.getWorkflowJobs(),
                this.configService.get<boolean>("enablePolling")
            ).pipe(
                map(([jobs, enablePolling]) =>
                    jobs.map(j =>
                        !isFinished(j) && enablePolling
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
