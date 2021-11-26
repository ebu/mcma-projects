import { ComponentFixture, TestBed } from "@angular/core/testing";

import { NewPasswordChallengeComponent } from "./new-password-challenge.component";

describe("ChangePasswordComponent", () => {
  let component: NewPasswordChallengeComponent;
  let fixture: ComponentFixture<NewPasswordChallengeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NewPasswordChallengeComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewPasswordChallengeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
