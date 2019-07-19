import { async, ComponentFixture, TestBed } from "@angular/core/testing";

import { MonitorQueueComponent } from "./monitor-queue.component";

describe("MonitorQueueComponent", () => {
  let component: MonitorQueueComponent;
  let fixture: ComponentFixture<MonitorQueueComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MonitorQueueComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MonitorQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
