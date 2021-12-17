/* "Barrel" of Http Interceptors */
import { HTTP_INTERCEPTORS } from "@angular/common/http";

import { AwsV4Interceptor } from "./awsv4-interceptor";

/** Http interceptor providers in outside-in order */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AwsV4Interceptor, multi: true },
];
