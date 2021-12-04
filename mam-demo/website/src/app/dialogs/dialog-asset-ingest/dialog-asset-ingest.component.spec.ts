import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DialogAssetIngestComponent } from "./dialog-asset-ingest.component";

describe("DialogAssetIngestComponent", () => {
  let component: DialogAssetIngestComponent;
  let fixture: ComponentFixture<DialogAssetIngestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DialogAssetIngestComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogAssetIngestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
