import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatButton } from "@angular/material/button";

@Component({
  selector: "app-dialog-asset-ingest",
  templateUrl: "./dialog-asset-ingest.component.html",
  styleUrls: ["./dialog-asset-ingest.component.scss"]
})
export class DialogAssetIngestComponent implements OnInit {

  @ViewChild("btnOK")
  public btnOK: MatButton | undefined;

  constructor() {
  }

  ngOnInit(): void {
  }

  static createDialog(dialog: MatDialog, hidden: boolean = false): MatDialogRef<DialogAssetIngestComponent> {
    return dialog.open(DialogAssetIngestComponent, {
      disableClose: true,
      panelClass: hidden ? "hide-dialog" : undefined,
      autoFocus: false,
      restoreFocus: false,
    });
  }

  static hideDialog(uploadDialogRef: MatDialogRef<DialogAssetIngestComponent>) {
    uploadDialogRef.addPanelClass("hide-dialog");
  }

  static showDialog(uploadDialogRef: MatDialogRef<DialogAssetIngestComponent>) {
    uploadDialogRef.removePanelClass("hide-dialog");
    uploadDialogRef.componentInstance.btnOK?.focus();
  }

  static closeDialog(uploadDialogRef: MatDialogRef<DialogAssetIngestComponent>) {
    uploadDialogRef.close();
  }
}
