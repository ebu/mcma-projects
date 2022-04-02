import { AfterViewChecked, AfterViewInit, Component, ViewChild } from "@angular/core";
import { DataService } from "../../services/data";
import { LoggerService } from "../../services";

import { MediaAssetProperties } from "@local/model";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { map, startWith, switchMap } from "rxjs/operators";
import { of, zip } from "rxjs";
import { Router } from "@angular/router";

const PageSize = 10;

@Component({
  selector: "app-browse",
  templateUrl: "./browse.component.html",
  styleUrls: ["./browse.component.scss"]
})
export class BrowseComponent implements AfterViewInit, AfterViewChecked {
  displayedColumns: string[] = ["thumbnail", "title", "description"];
  mediaAssets: MediaAssetProperties[] = [];

  resultsLength = 0;
  nextPageTokens: string[] = [];
  isLoadingResults = true;

  @ViewChild(MatPaginator) paginator: MatPaginator | undefined;

  constructor(private router: Router,
              private data: DataService,
              private logger: LoggerService) {
  }

  ngAfterViewInit(): void {
    this.paginator!.page.pipe(
      startWith({ pageIndex: 0, pageSize: PageSize, length: 0 }),
      switchMap((event: PageEvent) => {
        this.isLoadingResults = true;
        return zip(of(event), this.data.listMediaAssets(PageSize, this.nextPageTokens[event.pageIndex]));
      }),
      map(([event, queryResults]) => {
        this.isLoadingResults = false;

        if (queryResults.nextPageStartToken) {
          this.nextPageTokens[event.pageIndex + 1] = queryResults.nextPageStartToken;
        }

        this.resultsLength = this.nextPageTokens.length * PageSize;
        return queryResults.results;
      })
    ).subscribe(mediaAssets => this.mediaAssets = mediaAssets);
  }

  ngAfterViewChecked(): void {
    const list = document.getElementsByClassName("mat-paginator-range-label");
    list[0].innerHTML = "Page: " + (this.paginator!.pageIndex + 1);
  }

  openAsset(mediaAsset: MediaAssetProperties) {
    this.logger.info(mediaAsset);

    const assetGuid = mediaAsset.id!.substring(mediaAsset.id!.lastIndexOf("/") + 1);

    this.router.navigate([`assets/${assetGuid}`]);
  }
}

