import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DialogSessionExpiredComponent } from "./dialog-session-expired.component";

describe("DialogAssetIngestComponent", () => {
  let component: DialogSessionExpiredComponent;
  let fixture: ComponentFixture<DialogSessionExpiredComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DialogSessionExpiredComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogSessionExpiredComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
