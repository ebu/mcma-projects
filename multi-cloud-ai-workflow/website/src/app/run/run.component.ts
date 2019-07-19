import { Component, OnInit } from "@angular/core";
import { MatSelectionListChange } from "@angular/material";
import { Observable, BehaviorSubject, zip } from "rxjs";
import { tap, share, filter, debounceTime, map, startWith, withLatestFrom } from "rxjs/operators";

import { S3Bucket } from "../models/s3-bucket";
import { S3Upload } from "../models/s3-upload";
import { S3BucketService } from "../services/s3bucket.service";
import { WorkflowService } from "../services/workflow.service";
import { ModalService } from "../services/modal.service";
import { RunCompleteModalComponent } from "./run-complete-modal/run-complete-modal.component";
import { FormControl } from "@angular/forms";
import { S3Object } from "../models/s3-object";
import { RunMetadataModalComponent } from "./run-metadata-modal/run-metadata-modal.component";

@Component({
  selector: "mcma-run",
  templateUrl: "./run.component.html",
  styleUrls: ["./run.component.scss"]
})
export class RunComponent implements OnInit {
  isLoading = true;
  bucket$: Observable<S3Bucket>;
  objects$: Observable<S3Object[]>;
  currentUpload$: Observable<S3Upload>;
  selectedKey: string;

  filter = new FormControl("");

  private runningWorkflowSubject = new BehaviorSubject(false);
  runningWorkflow$ = this.runningWorkflowSubject.asObservable().pipe(tap(val => console.log(val)), share());

  constructor(private s3BucketService: S3BucketService, private workflowService: WorkflowService, private modalService: ModalService) {
    this.bucket$ = this.s3BucketService.bucket$.pipe(tap(b => this.isLoading = !b));
    
    this.objects$ =
      this.filter.valueChanges.pipe(
        debounceTime(300),
        startWith(""),
        withLatestFrom(this.bucket$),
        map(([val, bucket]) => !!bucket ? bucket.objects.filter(o => !val || val === "" || o.key.indexOf(val) >= 0) : []));
  }

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.isLoading = true;
    this.s3BucketService.listObjects();
  }

  onSelectedObjectChanged(e: MatSelectionListChange) {
    e.source.options.forEach(opt => {
      if (opt.value !== e.option.value) {
        opt.selected = false;
      }
    });
    this.selectedKey = e.option.value.key;
  }

  onDragOver(evt: DragEvent) {
    evt.preventDefault();
  }

  onDrop(evt: DragEvent) {
    evt.preventDefault();
    this.uploadFile(evt.dataTransfer.files);
  }

  uploadFileChanged(evt: Event): void {
    this.uploadFile((<HTMLInputElement>evt.target).files);
  }

  private uploadFile(files: FileList): void {
    const fileToUpload = files.item(0);
    if (fileToUpload) {
      this.selectedKey = fileToUpload.name;
      this.currentUpload$ = this.s3BucketService.uploadObject(fileToUpload).pipe(
        tap(curUpload => {
          // when upload completes
          const sub = curUpload.completed$.subscribe(
            () => {
              this.currentUpload$ = null;
              sub.unsubscribe();
              this.refresh();
            });
        })
      );
    }
  }

  runWorkflow(): void {
    if (this.selectedKey) {
      this.modalService.showModal(RunMetadataModalComponent);

      const sub1 = this.modalService.currentModal$.subscribe(m => {
        // when modal clears, get data, if any
        if (m && !m.componentType && m.data) {
          this.runningWorkflowSubject.next(true);
          const sub2 = this.workflowService.runWorkflow(this.selectedKey, m.data).pipe(filter(job => !!job))
            .subscribe(job => {
              this.runningWorkflowSubject.next(false);
              this.modalService.showModal(RunCompleteModalComponent, { job });
              sub2.unsubscribe();
            });
            
            sub1.unsubscribe();
        }
      });
    }
  }
}
