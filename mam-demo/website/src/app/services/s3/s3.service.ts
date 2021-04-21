import { Observable, zip } from "rxjs";
import { map } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { ConfigService } from "../../services/config";
import { LoggerService } from "../../services/logger";

import { S3FileUploader } from "./s3-file-uploader";
import { CognitoAuthService } from "../cognito-auth";
import { S3Provider } from "./s3-provider";

@Injectable({
  providedIn: "root"
})
export class S3Service {

  constructor(
    private auth: CognitoAuthService,
    private config: ConfigService,
    private logger: LoggerService
  ) {
  }

  private getS3Info(): Observable<{ s3Provider: S3Provider, bucket: string, identityId: string }> {
    return zip(
      this.auth.getCredentials(),
      this.config.get<string>("AwsRegion"),
      this.config.get<string>("MediaBucket")
    ).pipe(
      map(([credentials, region, bucket]) => {
          return {
            s3Provider: new S3Provider(this.auth, this.logger, region, credentials),
            bucket: bucket,
            identityId: credentials.identityId,
          };
        }
      )
    );
  }

  public getS3FileUploader(): Observable<S3FileUploader> {
    return this.getS3Info().pipe(
      map(({ s3Provider, bucket, identityId }) => new S3FileUploader(bucket, identityId, s3Provider, this.logger)),
    );
  }
}
