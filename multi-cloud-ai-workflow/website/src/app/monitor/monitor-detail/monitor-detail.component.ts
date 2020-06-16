import { Component, Input } from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";
import { map, switchMap, tap } from "rxjs/operators";

import { WorkflowService } from "../../services/workflow.service";
import { ContentService } from "../../services/content.service";
import { ConfigService } from "../../services/config.service";
import { WorkflowJobViewModel } from "../../view-models/workflow-job-vm";
import { ContentViewModel } from "../../view-models/content-vm";
import { McmaClientService } from 'src/app/services/mcma-client.service';

@Component({
    selector: "mcma-monitor-detail",
    templateUrl: "./monitor-detail.component.html",
    styleUrls: ["./monitor-detail.component.scss"],
    // encapsulation: ViewEncapsulation.None,
})
export class MonitorDetailComponent {
    private _conformJobVm$: Observable<WorkflowJobViewModel>;
    aiJobVm$: Observable<WorkflowJobViewModel>;
    content$: Observable<ContentViewModel>;
    private currentTimeSubject$ = new BehaviorSubject<number>(0);
    currentTime$ = this.currentTimeSubject$.asObservable();
    isSpeechToSpeechVisible = true;

    constructor(
        private workflowService: WorkflowService,
        private contentService: ContentService,
        private configService: ConfigService,
        private mcmaClientService: McmaClientService
    ) {

    }

    get conformJobVm$(): Observable<WorkflowJobViewModel> {
        return this._conformJobVm$;
    }

    @Input() set conformJobVm$(val: Observable<WorkflowJobViewModel>) {
        this._conformJobVm$ = val;

        if (val) {
            this.aiJobVm$ = val.pipe(
                switchMap(conformJobVm =>
                    this.configService.get<boolean>("enablePolling").pipe(
                        switchMap(enablePolling =>
                            conformJobVm.isCompleted && conformJobVm.aiJobUrl
                                ? enablePolling
                                ? this.workflowService.pollForCompletion(conformJobVm.aiJobUrl)
                                : this.workflowService.getWorkflowJobVm(conformJobVm.aiJobUrl)
                                : of(null)
                        )
                    )
                )
            );

            this.content$ = val.pipe(
                switchMap(conformJobVm =>
                    this.configService.get<boolean>("enablePolling").pipe(
                        switchMap(enablePolling =>
                            conformJobVm.isCompleted && conformJobVm.contentUrl
                                ? enablePolling
                                ? this.contentService.pollUntil(conformJobVm.contentUrl, this.aiJobVm$.pipe(map(aiJobVm => aiJobVm && aiJobVm.isFinished)))
                                : this.contentService.getContent(conformJobVm.contentUrl).pipe(map(c => new ContentViewModel(c, this.mcmaClientService)))
                                : of(null)
                        )
                    )
                ),
                tap(contentVm => console.log("got content vm", contentVm))
            );
        }
    }

    seekVideoAws(timestamp: { timecode: string, seconds: number }): void {
        this.currentTimeSubject$.next(timestamp.seconds);
    }

    seekVideoAzure(instance: any): void {
        console.log(instance);

        const time = instance.start;
        const timeParts = time.split(":");

        let timeSeconds = 0;

        for (const timePart of timeParts) {
            const parsed = Number.parseFloat(timePart);
            timeSeconds *= 60;
            timeSeconds += parsed;
        }

        this.currentTimeSubject$.next(timeSeconds);
    }

    toggleTabSpeechToSpeech() {
        this.isSpeechToSpeechVisible = !this.isSpeechToSpeechVisible;
    }

}
