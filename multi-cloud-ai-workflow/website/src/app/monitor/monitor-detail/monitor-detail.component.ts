import { Component, Input } from "@angular/core";
import { Observable, of, BehaviorSubject } from "rxjs";
import { switchMap, tap, map } from "rxjs/operators";

import { WorkflowService } from "../../services/workflow.service";
import { ContentService } from "../../services/content.service";
import { WorkflowJobViewModel } from "../../view-models/workflow-job-vm";
import { ContentViewModel } from "../../view-models/content-vm";

@Component({
    selector: "mcma-monitor-detail",
    templateUrl: "./monitor-detail.component.html",
    styleUrls: ["./monitor-detail.component.scss"]
})
export class MonitorDetailComponent {
    private _conformJobVm$: Observable<WorkflowJobViewModel>;
    aiJobVm$: Observable<WorkflowJobViewModel>;
    content$: Observable<ContentViewModel>;

    private currentTimeSubject = new BehaviorSubject<number>(0);
    currentTime$ = this.currentTimeSubject.asObservable();

    selectedAzureCelebrity;

    get conformJobVm$(): Observable<WorkflowJobViewModel> { return this._conformJobVm$; }
    @Input() set conformJobVm$(val: Observable<WorkflowJobViewModel>) {
        this._conformJobVm$ = val;

        if (val) {
            this.aiJobVm$ = val.pipe(
                switchMap(conformJobVm => 
                    conformJobVm.isCompleted && conformJobVm.aiJobUrl
                        ? this.workflowService.pollForCompletion(conformJobVm.aiJobUrl)
                        : of(null)
                )
            );
            
            this.content$ = val.pipe(
                switchMap(conformJobVm =>
                    conformJobVm.isCompleted && conformJobVm.contentUrl
                        ? this.contentService.pollUntil(conformJobVm.contentUrl, this.aiJobVm$.pipe(map(aiJobVm => aiJobVm && aiJobVm.isFinished)))
                        : of (null)
                ),
                tap(contentVm => console.log("got content vm", contentVm))
            );
        }
    }

    constructor(private workflowService: WorkflowService, private contentService: ContentService) {}

    seekVideoAws(timestamp: { timecode: string, seconds: number }): void {
        this.currentTimeSubject.next(timestamp.seconds);
    }

    seekVideoAzure(instance: any): void {
        console.log(instance);

        let time = instance.start;
        let timeParts = time.split(":");

        let timeSeconds = 0;

        for (const timePart of timeParts) {
            let parsed = Number.parseFloat(timePart);
            timeSeconds *= 60;
            timeSeconds += parsed;
        }

        this.currentTimeSubject.next(timeSeconds);
    }
}
