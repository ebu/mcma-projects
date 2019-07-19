import { async, ComponentFixture, TestBed } from "@angular/core/testing";

import { RunCompleteModalComponent } from "./run-complete-modal.component";

describe("RunCompleteModalComponent", () => {
  let component: RunCompleteModalComponent;
  let fixture: ComponentFixture<RunCompleteModalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RunCompleteModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RunCompleteModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
