import { Injectable, isDevMode } from "@angular/core";

const noop = (): any => undefined;

@Injectable({
  providedIn: "root"
})
export class LoggerService {

  constructor() {
  }

  get info() {
    if (isDevMode()) {
      return console.info.bind(console);
    } else {
      return noop;
    }
  }

  get warn() {
    return console.warn.bind(console);
  }

  get error() {
    return console.error.bind(console);
  }
}
