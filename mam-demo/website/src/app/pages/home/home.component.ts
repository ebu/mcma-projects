import { Component, OnInit } from "@angular/core";
import { User } from "../../model";
import { CognitoAuthService } from "../../services";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"]
})
export class HomeComponent implements OnInit {
  user: User | null = null;

  constructor(
    private auth: CognitoAuthService,
  ) {
    auth.status$.subscribe(_ => {
      this.user = auth.getUser();
    });
  }

  ngOnInit(): void {
  }

  logout() {
    this.auth.logout().subscribe();
  }
}
