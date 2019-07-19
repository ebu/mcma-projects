import { BehaviorSubject, Observable, from } from "rxjs";
import { ManagedUpload } from "aws-sdk/clients/s3";

export class S3Upload {

    private percentCompleteSubject = new BehaviorSubject<number>(0);
    percentComplete$ = this.percentCompleteSubject.asObservable();

    completed$: Observable<ManagedUpload.SendData>;

    constructor(public key: string, private managedUpload: ManagedUpload) {
        this.completed$ = from(this.managedUpload.promise());

        this.managedUpload.on("httpUploadProgress", progress => {
            this.percentCompleteSubject.next(Math.round((progress.loaded / progress.total) * 10000) / 100);
        });
    }
}