import { TestBed } from "@angular/core/testing";

import { CognitoAuthGuard } from "./cognito-auth.guard";

describe("AuthGuard", () => {
  let guard: CognitoAuthGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(CognitoAuthGuard);
  });

  it("should be created", () => {
    expect(guard).toBeTruthy();
  });
});
