import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RunMetadataModalComponent } from './run-metadata-modal.component';

describe('RunMetadataModalComponent', () => {
  let component: RunMetadataModalComponent;
  let fixture: ComponentFixture<RunMetadataModalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RunMetadataModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RunMetadataModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
