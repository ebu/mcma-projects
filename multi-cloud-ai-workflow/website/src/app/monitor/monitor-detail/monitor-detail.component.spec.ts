import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MonitorDetailComponent } from './monitor-detail.component';

describe('MonitorDetailComponent', () => {
  let component: MonitorDetailComponent;
  let fixture: ComponentFixture<MonitorDetailComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MonitorDetailComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MonitorDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
