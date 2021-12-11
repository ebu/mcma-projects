import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatButton } from "@angular/material/button";

@Component({
  selector: "app-dialog-session-expired",
  templateUrl: "./dialog-session-expired.component.html",
  styleUrls: ["./dialog-session-expired.component.scss"]
})
export class DialogSessionExpiredComponent implements OnInit {

  @ViewChild("btnOK")
  public btnOK: MatButton | undefined;

  constructor() {
  }

  ngOnInit(): void {
  }

  login(): void {
    window.location.reload();
  }

  static createDialog(dialog: MatDialog, hidden: boolean = false): MatDialogRef<DialogSessionExpiredComponent> {
    return dialog.open(DialogSessionExpiredComponent, {
      disableClose: true,
      panelClass: hidden ? "hide-dialog" : undefined,
    });
  }

  static hideDialog(uploadDialogRef: MatDialogRef<DialogSessionExpiredComponent>) {
    uploadDialogRef.addPanelClass("hide-dialog");
  }

  static showDialog(uploadDialogRef: MatDialogRef<DialogSessionExpiredComponent>) {
    uploadDialogRef.removePanelClass("hide-dialog");
    uploadDialogRef.componentInstance.btnOK?.focus();
  }

  static closeDialog(uploadDialogRef: MatDialogRef<DialogSessionExpiredComponent>) {
    uploadDialogRef.close();
  }
}
