import { Component, Input } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, withLatestFrom, filter, map } from 'rxjs/operators';

import { WorkflowService } from '../../services/workflow.service';
import { ContentService } from '../../services/content.service';
import { WorkflowJobViewModel } from '../../view-models/workflow-job-vm';
import { ContentViewModel } from '../../view-models/content-vm';

@Component({
    selector: 'mcma-monitor-detail',
    templateUrl: './monitor-detail.component.html',
    styleUrls: ['./monitor-detail.component.scss']
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
            
            this.content$ = this.aiJobVm$.pipe(
                filter(aiJobVm => aiJobVm && aiJobVm.isCompleted),
                withLatestFrom(val),
                switchMap(([aiJobVm, conformJobVm]) =>
                    conformJobVm.contentUrl
                        ? this.contentService.getContent(conformJobVm.contentUrl).pipe(map(c => new ContentViewModel(c)))
                        : of(null)
                )
            );
        }
    }

    constructor(private workflowService: WorkflowService, private contentService: ContentService) {}

    selectAzureCelebrity(row: any): void {
        console.log(row);
        this.selectedAzureCelebrity = row;
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
