import { Component, OnInit } from '@angular/core';
import { MatSelectionListChange } from '@angular/material';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { S3Bucket } from '../models/s3-bucket';
import { S3Upload } from '../models/s3-upload';
import { S3BucketService } from '../services/s3bucket.service';
import { WorkflowService } from '../services/workflow.service';

@Component({
  selector: 'mcma-run',
  templateUrl: './run.component.html',
  styleUrls: ['./run.component.scss']
})
export class RunComponent implements OnInit {
  isLoading = true;
  runningWorkflow = false;
  bucket$: Observable<S3Bucket>;
  currentUpload$: Observable<S3Upload>;
  
  selectedKey: string;

  constructor(private s3BucketService: S3BucketService, private workflowService: WorkflowService) {
    this.bucket$ = this.s3BucketService.bucket$.pipe(tap(b => {
      if (!!b) {
        this.isLoading = false;
      }
    }));
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

  uploadFileChanged(evt: Event): void {
    const fileToUpload = (<HTMLInputElement>evt.target).files.item(0);
    if (fileToUpload) {
      this.selectedKey = fileToUpload.name;
      this.currentUpload$ = this.s3BucketService.uploadObject(fileToUpload).pipe(
        tap(curUpload =>
          // when upload completes
          curUpload.completed$.subscribe(
            () => {
              this.currentUpload$ = null;
              this.refresh();
            })
        )
      );
    }
  }

  runWorkflow(): void {
    if (this.selectedKey) {
      this.runningWorkflow = true;
      this.workflowService.runWorkflow(this.selectedKey).subscribe(w => this.runningWorkflow = false);
    }
  }
}
