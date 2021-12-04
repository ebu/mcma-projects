import { Component, OnInit } from "@angular/core";

@Component({
  selector: "app-browse",
  templateUrl: "./browse.component.html",
  styleUrls: ["./browse.component.scss"]
})
export class BrowseComponent implements OnInit {

  constructor() {
    console.log("ctr browse component");
  }

  ngOnInit(): void {
    console.log("init browse component");
  }

}
