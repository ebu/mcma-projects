import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { switchMap } from "rxjs/operators";
import { QueryResults } from "@mcma/data";

import { MediaAsset, MediaWorkflow } from "@local/model";

import { ConfigService } from "../config";

@Injectable({
  providedIn: "root"
})
export class DataService {

  constructor(private http: HttpClient, private config: ConfigService) {
  }

  private getRestApiUrl() {
    return this.config.get<string>("RestApiUrl");
  }

  createWorkflow(workflow: MediaWorkflow) {
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.post<MediaWorkflow>(`${url}/workflows`, workflow))
    );
  }

  listWorkflows() {
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<QueryResults<MediaWorkflow>>(`${url}/workflows`))
    );
  }

  listMediaAssets(pageSize: number, pageStartToken?: string) {
    const params: any = {
      sortBy: "dateCreated",
      sortOrder: "desc",
      pageSize: pageSize,
    };
    if (pageStartToken) {
      params.pageStartToken = pageStartToken;
    }
    return this.getRestApiUrl().pipe(
      switchMap(url => this.http.get<QueryResults<MediaAsset>>(`${url}/assets`, {
        params: params
      }))
    );
  }
}
