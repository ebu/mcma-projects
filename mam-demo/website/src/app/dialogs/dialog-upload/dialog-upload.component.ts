import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material/dialog";
import { Observable, Subject, Subscription } from "rxjs";
import * as filesize from "filesize";
import { LoggerService, S3FileUploader, S3Service } from "../../services";
import { FileDescriptor } from "../../model";
import { DialogSessionExpiredComponent } from "../dialog-session-expired";

const average = (arr: number[]) => arr.reduce((p, c) => p + c, 0) / arr.length;

enum Status {
  Uploading = "Uploading",
  ErrorSessionTimeout = "Error - Session Timeout",
}

@Component({
  selector: "app-dialog-upload",
  templateUrl: "./dialog-upload.component.html",
  styleUrls: ["./dialog-upload.component.scss"]
})
export class DialogUploadComponent implements OnInit {
  private statusSubject: Subject<{ success: boolean, bucket?: string, filesPrefix?: string }> = new Subject<{ success: boolean, bucket?: string, filesPrefix?: string }>();
  status$: Observable<{ success: boolean, bucket?: string, filesPrefix?: string }> = this.statusSubject.asObservable();

  title: string = "";
  totalFiles: number = 0;

  filename: string = "";
  filesRemaining: number = 0;
  bytesRemaining: number = 0;
  percentage: number = 0;
  uploadSpeedText: string = "";

  private readonly uploadedBytes: number[] = [];

  timeRemainingStartTime: number = 0;
  timeRemainingText: string = "Calculating...";
  timeRemainingTimestamp: number = 0;

  private subscription?: Subscription;
  private s3FileUploader?: S3FileUploader;

  status: Status = Status.Uploading;

  constructor(private dialog: MatDialog,
              private dialogRef: MatDialogRef<DialogUploadComponent>,
              @Inject(MAT_DIALOG_DATA) private data: { targetFolder: string, files: FileDescriptor[] },
              private s3: S3Service,
              private logger: LoggerService) {
  }

  ngOnInit(): void {
    this.s3.getS3FileUploader().subscribe(s3FileUploader => {
      this.s3FileUploader = s3FileUploader;

      const status$ = this.s3FileUploader.uploadFiles(this.data.targetFolder, this.data.files);

      this.timeRemainingStartTime = Date.now();

      this.subscription = status$.subscribe((status) => {
        this.uploadedBytes.push(status.uploadedBytes);
        if (this.uploadedBytes.length === 20) {
          let uploadedBytesLastSecond = average(this.uploadedBytes.slice(10, 19)) - average(this.uploadedBytes.slice(0, 9));
          if (uploadedBytesLastSecond < 0) {
            uploadedBytesLastSecond = 0;
          }
          this.uploadSpeedText = `${filesize(uploadedBytesLastSecond, { round: 0 })}/s`;
          this.uploadedBytes.shift();

          // when file uploader suddenly stops it's because there was an error detected
          // This is expected whenever the session times out.
          if (this.status === Status.Uploading && s3FileUploader.maxConcurrentRequests === 0) {
            this.status = Status.ErrorSessionTimeout;
            DialogSessionExpiredComponent.createDialog(this.dialog);
          }
        }

        if (this.totalFiles !== status.totalFiles) {
          this.totalFiles = status.totalFiles;
          this.title = this.totalFiles + " " + (this.totalFiles === 1 ? "item" : "items");
        }

        this.filename = status.filename;
        this.percentage = (Math.floor(status.uploadedBytes / status.totalBytes * 1000)) / 10;

        this.filesRemaining = status.totalFiles - status.uploadedFiles;
        this.bytesRemaining = status.totalBytes - status.uploadedBytes;

        if (this.status !== Status.Uploading) {
          this.timeRemainingText = this.status;
        } else {
          const now = Date.now();

          const timeElapsed = now - this.timeRemainingStartTime;
          const timeSinceLastChange = now - this.timeRemainingTimestamp;
          if (timeElapsed > 5000 && timeSinceLastChange > 5000) {
            const bytesPerMs = status.uploadedBytes / timeElapsed;
            let secondsRemaining = Math.floor(this.bytesRemaining / bytesPerMs / 1000);

            this.timeRemainingTimestamp = now;

            let text;
            if (secondsRemaining > 60) {
              let minutesRemaining = Math.floor(secondsRemaining / 60);

              if (minutesRemaining > 60) {
                const hoursRemaining = Math.floor(minutesRemaining / 60);

                minutesRemaining = minutesRemaining % 60;

                text = `About ${hoursRemaining} ` + (hoursRemaining > 1 ? "hours" : "hour");

                if (minutesRemaining > 0) {
                  text += ` and ${minutesRemaining} ` + (minutesRemaining > 1 ? "minutes" : "minute");
                }
              } else {
                text = `About ${minutesRemaining} ` + (minutesRemaining > 1 ? "minutes" : "minute");
              }
            } else {
              secondsRemaining = (Math.floor(secondsRemaining / 5) + 1) * 5;

              text = `About ${secondsRemaining} seconds`;
            }

            if (text !== this.timeRemainingText) {
              this.timeRemainingText = text;
              this.timeRemainingTimestamp = now;
            }
          }
        }
      }, error => {
        this.logger.error(error);
      }, () => {
        setTimeout(() => {
          let targetFolder = this.data.targetFolder;
          if (!targetFolder.startsWith("/")) {
            targetFolder = "/" + targetFolder;
          }
          if (!targetFolder.endsWith("/")) {
            targetFolder = targetFolder + "/";
          }
          this.statusSubject.next({ success: true, bucket: s3FileUploader.bucket, filesPrefix: s3FileUploader.identityId + targetFolder });
        }, 1);
      });
    }, error => {
      this.logger.error("DialogUploadComponent.onInit error");
      this.logger.error(error);
      this.cancel();
      DialogSessionExpiredComponent.createDialog(this.dialog);
    });
  }

  cancel(): void {
    this.subscription?.unsubscribe();
    this.statusSubject.next({ success: false });
  }

  static createDialog(dialog: MatDialog, targetFolder: string, files: FileDescriptor[], hasBackdrop: boolean = true): MatDialogRef<DialogUploadComponent> {
    return dialog.open(DialogUploadComponent, {
      width: "500px",
      autoFocus: false,
      restoreFocus: false,
      disableClose: true,
      hasBackdrop: hasBackdrop,
      data: {
        targetFolder,
        files
      },
    });
  }

  static closeDialog(uploadDialogRef: MatDialogRef<DialogUploadComponent>) {
    uploadDialogRef.close();
  }
}
