import { CognitoAuthService } from "../cognito-auth";
import { LoggerService } from "../../services";
import { CognitoIdentityCredentials, S3 } from "aws-sdk";
import { map } from "rxjs/operators";

export class S3Provider {
  private s3: S3 | undefined;
  private expireTime: number;
  private generating: boolean;

  constructor(private auth: CognitoAuthService,
              private logger: LoggerService,
              private region: string,
              credentials: CognitoIdentityCredentials) {
    this.expireTime = 0;
    this.generating = false;
    this.generateS3(credentials);
  }

  async get(): Promise<S3> {
    while (this.generating) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
    }

    if (this.s3 && this.expireTime > Date.now()) {
      return this.s3;
    }

    this.generating = true;
    return this.auth.getCredentials().pipe(
      map((credentials) => this.generateS3(credentials))
    ).toPromise().finally(() => {
      this.generating = false;
    });
  }

  private generateS3(credentials: CognitoIdentityCredentials) {
    this.expireTime = Date.now() + 5 * 60 * 1000; // 5 minutes
    return this.s3 = new S3({ credentials, region: this.region, endpoint: "s3-accelerate.amazonaws.com", httpOptions: { timeout: 0 } });
  }
}
