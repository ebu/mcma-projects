import { Component, OnInit } from "@angular/core";
import { DataService } from "../../services/data";
import { LoggerService } from "../../services";

@Component({
  selector: "app-browse",
  templateUrl: "./browse.component.html",
  styleUrls: ["./browse.component.scss"]
})
export class BrowseComponent implements OnInit {

  constructor(private data: DataService, private logger: LoggerService) {
  }

  ngOnInit(): void {
    this.data.listWorkflows().subscribe(x => this.logger.info(x));
  }

}
