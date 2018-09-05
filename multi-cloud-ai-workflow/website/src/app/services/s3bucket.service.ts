import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, } from 'rxjs';
import { switchMap, map, zip } from 'rxjs/operators';

import { S3 } from 'aws-sdk';

import { asObservableWithInput } from './aws-observable-utils';
import { CognitoAuthService } from './cognito-auth.service';
import { ConfigService } from './config.service';
import { S3Bucket } from '../models/s3-bucket';
import { S3Upload } from '../models/s3-upload';

@Injectable()
export class S3BucketService {

    private bucketSubject = new BehaviorSubject<S3Bucket>(null);
    bucket$ = this.bucketSubject.asObservable();

    private s3$: Observable<S3>;

    constructor(private configService: ConfigService, private cognitoAuthService: CognitoAuthService) {
        this.s3$ = 
            this.cognitoAuthService.credentials$.pipe(
                zip(this.configService.get<string>('aws.region')),
                map(([creds, region]) => new S3({credentials: creds, region: region})));
    }

    listObjects(): void {
        this.bucketSubject.next(null);
        const sub = this.s3$.pipe(
            zip(this.configService.get<string>('aws.s3.uploadBucket')),
            switchMap(([s3, uploadBucket]) =>
                asObservableWithInput<S3.ListObjectsRequest, S3.ListObjectsOutput>(s3, s3.listObjects, { Bucket: uploadBucket })),
            map((resp) => {
                return {
                    name: resp.Name,
                    objects: resp.Contents.map(c => {
                        return {
                            key: c.Key,
                            etag: c.ETag,
                            size: c.Size,
                            lastModified: c.LastModified,
                            owner: c.Owner.DisplayName
                        };
                    })
                };
            })
        ).subscribe(bucket => {
            sub.unsubscribe();
            this.bucketSubject.next(bucket);
        });
    }

    uploadObject(file: File): Observable<S3Upload> {
        return this.s3$.pipe(
            zip(this.configService.get<string>('aws.s3.uploadBucket')),
            map(([s3, bucketName]) => new S3Upload(file.name, s3.upload({ Bucket: bucketName, Key: file.name, Body: file })))
        );
    }
}