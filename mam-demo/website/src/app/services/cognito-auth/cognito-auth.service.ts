import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, of, zip } from "rxjs";
import { catchError, map, shareReplay, switchMap } from "rxjs/operators";
import { fromPromise } from "rxjs/internal-compatibility";
import { CognitoIdentityCredentials } from "aws-sdk";
import { AuthenticationDetails, CognitoUser, CognitoUserPool, CognitoUserSession, ICognitoUserPoolData } from "amazon-cognito-identity-js";

import { User } from "../../model";
import { ConfigService } from "../../services/config";
import { LoggerService } from "../../services/logger";

export enum AuthStatus {
  NotAuthenticated,
  Authenticated,
  ActionRequired,
}

export interface AuthAction {
  type: string;
  data?: { [key: string]: any };
}

export enum CognitoAuthActionType {
  None = "None",
  NewPasswordChallenge = "NewPasswordChallenge",
  ForgotPassword = "ForgotPassword",
}

@Injectable({
  providedIn: "root"
})
export class CognitoAuthService {
  public status$: Observable<AuthStatus>;

  protected statusSubject: BehaviorSubject<AuthStatus>;
  protected user: User | null;
  protected credentials: CognitoIdentityCredentials | null;

  private authAction: AuthAction;

  private cognitoUserPool: CognitoUserPool | null;
  private cognitoUser: CognitoUser | null;

  constructor(private config: ConfigService, private logger: LoggerService) {
    this.statusSubject = new BehaviorSubject<AuthStatus>(AuthStatus.NotAuthenticated);
    this.status$ = this.statusSubject.asObservable();
    this.user = null;
    this.credentials = null;

    this.authAction = { type: CognitoAuthActionType.None };
    this.cognitoUserPool = null;
    this.cognitoUser = null;

    this.getCurrentSession().subscribe(session => {
      this.onCognitoSession(session, "Cognito session loaded from browser");
    }, _ => {
      this.logger.info("No existing cognito session found");
    });
  }

  getUser(): User | null {
    return this.user;
  }

  getAuthAction(): AuthAction {
    return this.authAction;
  }

  login(parameters: { username: string, password: string }): Observable<void> {
    return this.getCognitoUserPool().pipe(
      switchMap(userPool => new Promise<void>((resolve, reject) => {
          try {
            this.cognitoUser = new CognitoUser({
              Username: parameters.username,
              Pool: userPool
            });

            const authDetails = new AuthenticationDetails({
              Username: parameters.username,
              Password: parameters.password
            });

            this.logger.info("Starting cognitoUser.authenticateUser");

            this.cognitoUser.authenticateUser(authDetails, {
              onSuccess: (session: CognitoUserSession) => {
                this.onCognitoSession(session, "cognitoUser.authenticateUser => onSuccess");
                resolve();
              },
              onFailure: (error: any) => {
                this.logger.info("cognitoUser.authenticateUser => onFailure");
                reject(error);
              },
              newPasswordRequired: (userAttributes: any, requiredAttributes: any) => {
                this.logger.info("cognitoUser.authenticateUser => newPasswordRequired");
                this.logger.info(JSON.stringify(userAttributes));
                this.logger.info(JSON.stringify(requiredAttributes));
                this.authAction = { type: CognitoAuthActionType.NewPasswordChallenge };
                this.statusSubject.next(AuthStatus.ActionRequired);
                resolve();
              },
              mfaRequired: (challengeName: any, challengeParameters: any) => {
                this.logger.info("cognitoUser.authenticateUser => mfaRequired");
                reject(new Error("Not implemented"));
              },
              totpRequired: (challengeName: any, challengeParameters: any) => {
                this.logger.info("cognitoUser.authenticateUser => totpRequired");
                reject(new Error("Not implemented"));
              },
              customChallenge: (challengeParameters: any) => {
                this.logger.info("cognitoUser.authenticateUser => customChallenge");
                reject(new Error("Not implemented"));
              },
              mfaSetup: (challengeName: any, challengeParameters: any) => {
                this.logger.info("cognitoUser.authenticateUser => mfaSetup");
                reject(new Error("Not implemented"));
              },
              selectMFAType: (challengeName: any, challengeParameters: any) => {
                this.logger.info("cognitoUser.authenticateUser => selectMFAType");
                reject(new Error("Not implemented"));
              },
            });
          } catch (error) {
            this.logger.info(error);
            reject(error);
          }
        })
      )
    );
  }

  logout(): Observable<void> {
    return this.getCurrentCognitoUser().pipe(
      switchMap(cognitoUser =>
        new Promise<void>((resolve) => {
          try {
            cognitoUser.globalSignOut({
              onSuccess: msg => {
                this.onCognitoLogout("logout.globalSignout.onSuccess: " + msg);
                resolve();
              },
              onFailure: error => {
                this.onCognitoLogout("logout.globalSignout.onFailure: " + error);
                resolve();
              }
            });
          } catch (error) {
            this.onCognitoLogout("logout.promise.catchError: " + error);
            resolve();
          }
        })
      ),
      catchError(err => {
        this.onCognitoLogout("logout.rxjs.catchError: " + err);
        return of(undefined);
      })
    );
  }

  completeNewPasswordChallenge(password: string): Observable<void> {
    this.authAction = { type: CognitoAuthActionType.None };
    return this.getCurrentCognitoUser().pipe(
      switchMap(cognitoUser => new Promise<void>((resolve, reject) => {
        try {
          this.logger.info("Starting cognitoUser.completeNewPasswordChallenge");

          cognitoUser.completeNewPasswordChallenge(password, {}, {
            onSuccess: session => {
              this.onCognitoSession(session, "cognitoUser.completeNewPasswordChallenge => onSuccess");
              return resolve();
            },
            onFailure: err => {
              this.logger.info("cognitoUser.completeNewPasswordChallenge => onFailure");
              return reject(err);
            },
            customChallenge: challengeParameters => {
              this.logger.info("cognitoUser.completeNewPasswordChallenge => customChallenge");
              return reject(new Error("Not implemented"));
            },
            mfaRequired: challengeName => {
              this.logger.info("cognitoUser.completeNewPasswordChallenge => mfaRequired");
              return reject(new Error("Not implemented"));
            },
            mfaSetup: challengeName => {
              this.logger.info("cognitoUser.completeNewPasswordChallenge => mfaSetup");
              return reject(new Error("Not implemented"));
            }
          });
        } catch (error) {
          this.logger.error(error);
          return reject(error);
        }
      }))
    );
  }

  forgotPassword(username?: string): Observable<void> {
    return of(1).pipe(
      map(() => {
        this.authAction = { type: CognitoAuthActionType.ForgotPassword, data: { username: username } };
        this.statusSubject.next(AuthStatus.ActionRequired);
      })
    );
  }

  requestPasswordResetCode(username: string): Observable<any> {
    this.authAction = { type: CognitoAuthActionType.None };

    return this.getCognitoUserPool().pipe(
      switchMap(userPool => new Promise<void>(
        (resolve, reject) => {
          try {
            this.cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool
            });

            this.logger.info("Starting cognitoUser.forgotPassword");

            this.cognitoUser.forgotPassword({
              onSuccess: data => {
                this.logger.info("cognitoUser.forgotPassword => onSuccess");
                this.logger.info(data);
                return resolve(data);
              },
              onFailure: err => {
                this.logger.info("cognitoUser.forgotPassword => onFailure");
                return reject(err);
              },
              inputVerificationCode: data => {
                this.logger.info("cognitoUser.forgotPassword => inputVerificationCode");
                this.logger.info(data);
                return resolve(data);
              }
            });
          } catch (error) {
            this.logger.info(error);
            reject(error);
          }
        })
      )
    );
  }

  submitPasswordResetCode(username: string, passwordResetCode: string, password: string): Observable<void> {
    return this.getCognitoUserPool().pipe(
      switchMap(userPool => new Promise<void>(
        (resolve, reject) => {
          try {
            this.cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool
            });

            this.logger.info("Starting cognitoUser.confirmPassword");

            this.cognitoUser.confirmPassword(passwordResetCode, password, {
              onSuccess: () => {
                this.logger.info("cognitoUser.confirmPassword => onSuccess");
                resolve();
              },
              onFailure: err => {
                this.logger.info("cognitoUser.confirmPassword => onFailure");
                reject(err);
              }
            });
          } catch (error) {
            this.logger.info(error);
            reject(error);
          }
        })
      )
    );
  }

  changePassword(username: string, oldPassword: string, newPassword: string): Observable<void> {
    return this.getCognitoUserPool().pipe(
      switchMap(userPool => new Promise<void>((resolve, reject) => {
          try {
            const cognitoUser = this.cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool
            });

            const authDetails = new AuthenticationDetails({
              Username: username,
              Password: oldPassword,
            });

            this.logger.info("Starting cognitoUser.changePassword");
            this.cognitoUser.authenticateUser(authDetails, {
              onSuccess: (session: CognitoUserSession) => {
                cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
                  if (err) {
                    return reject(err);
                  }
                  this.onCognitoSession(session, "cognitoUser.authenticateUser => onSuccess");
                  resolve();
                });
              },
              onFailure: (error: any) => {
                this.logger.info("cognitoUser.authenticateUser => onFailure");
                reject(error);
              },
            });
          } catch (error) {
            this.logger.info(error);
            reject(error);
          }
        })
      )
    );
  }

  getCredentials(): Observable<CognitoIdentityCredentials> {
    return zip(
      this.getCognitoUserPool(),
      this.getCurrentSession(),
      this.config.get<string>("CognitoIdentityPoolId"),
      this.config.get<string>("AwsRegion")
    ).pipe(
      switchMap(([userPool, session, cognitoIdentityPoolId, region]) => {
        const credentials = this.credentials = new CognitoIdentityCredentials({
          IdentityPoolId: cognitoIdentityPoolId,
          Logins: {
            [`cognito-idp.${region}.amazonaws.com/${userPool.getUserPoolId()}`]: session.getIdToken().getJwtToken()
          }
        }, { region });

        return fromPromise(credentials.getPromise().then(() => credentials));
      })
    );
  }

  private getCognitoUserPool(): Observable<CognitoUserPool> {
    if (this.cognitoUserPool) {
      return of(this.cognitoUserPool);
    }

    return this.config.get<ICognitoUserPoolData>("CognitoUserPool").pipe(
      map(userPoolData => this.cognitoUserPool = new CognitoUserPool(userPoolData)),
      shareReplay(1)
    );
  }

  private getCurrentCognitoUser(): Observable<CognitoUser> {
    if (this.cognitoUser) {
      return of(this.cognitoUser);
    }

    return this.getCognitoUserPool().pipe(
      map(userPool => {
        this.cognitoUser = userPool.getCurrentUser();
        if (this.cognitoUser === null) {
          throw new Error("No Cognito User");
        }
        return this.cognitoUser;
      })
    );
  }

  private getCurrentSession(): Observable<CognitoUserSession> {
    return this.getCurrentCognitoUser().pipe(
      switchMap(cognitoUser => new Promise<CognitoUserSession>((resolve, reject) => {
        cognitoUser.getSession((error: Error | null, session: null | CognitoUserSession) => {
          if (error) {
            return reject(error);
          }
          if (!session) {
            return reject(new Error("No valid session"));
          }
          return resolve(session);
        });
      }))
    );
  }

  private onCognitoSession(session: CognitoUserSession, source: string) {
    this.logger.info(source);
    this.logger.info(session);
    this.user = new User({
      name: session.getIdToken().payload["cognito:username"],
      email: session.getIdToken().payload["email"],
      groups: session.getIdToken().payload["cognito:groups"],
    });
    this.statusSubject.next(AuthStatus.Authenticated);
  }

  private onCognitoLogout(source: string) {
    this.logger.info(source);
    this.credentials?.clearCachedId();
    this.credentials = null;
    this.cognitoUser?.signOut();
    this.cognitoUser = null;
    this.user = null;
    this.statusSubject.next(AuthStatus.NotAuthenticated);
  }
}
