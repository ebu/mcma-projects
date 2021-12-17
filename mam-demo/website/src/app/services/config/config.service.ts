import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { map, shareReplay, tap } from "rxjs/operators";

import { LoggerService } from "../logger";

@Injectable({
  providedIn: "root"
})
export class ConfigService {

  private readonly config: Observable<any>;

  constructor(private http: HttpClient, private logger: LoggerService) {
    this.config = this.http.get("config.json").pipe(
      tap(_ => this.logger.info("Loaded config.json")),
      shareReplay(1)
    );
  }

  get<T>(key: string, defaultVal?: T): Observable<T> {
    return this.config.pipe(
      map(c => {

        let val = c;
        for (const keyPart of key.split(".")) {
          if (!val.hasOwnProperty(keyPart)) {
            this.logger.info(`Value for key '${key}' not found. Returning default value '${defaultVal}'`);
            return defaultVal;
          }
          val = val[keyPart];
        }
        return val;
      })
    );
  }
}
