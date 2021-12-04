import { ComponentFixture, TestBed } from "@angular/core/testing";

import { BrowseComponent } from "./browse.component";

describe("HomeComponent", () => {
  let component: BrowseComponent;
  let fixture: ComponentFixture<BrowseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BrowseComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BrowseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
