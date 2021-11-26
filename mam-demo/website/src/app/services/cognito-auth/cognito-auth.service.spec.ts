import { TestBed } from "@angular/core/testing";

import { CognitoAuthService } from "./cognito-auth.service";

describe("CognitoAuthService", () => {
  let service: CognitoAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CognitoAuthService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
