import { Component, OnInit } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-dialog-asset-ingest",
  templateUrl: "./dialog-asset-ingest.component.html",
  styleUrls: ["./dialog-asset-ingest.component.scss"]
})
export class DialogAssetIngestComponent implements OnInit {

  constructor() {
  }

  ngOnInit(): void {
  }

  static createDialog(dialog: MatDialog, hidden: boolean = false): MatDialogRef<DialogAssetIngestComponent> {
    return dialog.open(DialogAssetIngestComponent, {
      disableClose: true,
      panelClass: hidden ? "hide-dialog" : undefined,
    });
  }

  static hideDialog(uploadDialogRef: MatDialogRef<DialogAssetIngestComponent>) {
    uploadDialogRef.addPanelClass("hide-dialog");
  }

  static showDialog(uploadDialogRef: MatDialogRef<DialogAssetIngestComponent>) {
    uploadDialogRef.removePanelClass("hide-dialog");
  }

  static closeDialog(uploadDialogRef: MatDialogRef<DialogAssetIngestComponent>) {
    uploadDialogRef.close();
  }
}
