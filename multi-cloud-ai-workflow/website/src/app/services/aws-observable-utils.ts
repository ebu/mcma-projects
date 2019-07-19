import { Observable, Subject } from "rxjs";
import { AWSError } from "aws-sdk";

export function asObservable<T>(caller: any, func: (callback: (err: AWSError, result: T) => void) => void): Observable<T> {
    const outputSubject = new Subject<T>();

    func.call(caller, (err, data) => {
        if (err) {
            outputSubject.error(err);
        } else {
            outputSubject.next(data);
        }
    });

    return outputSubject.asObservable();
}

export function asObservableWithInput<TIn, TOut>(caller: any,
    func: (input: TIn, callback: (err: AWSError, result: TOut) => void) => void,
    input: TIn): Observable<TOut> {
    const outputSubject = new Subject<TOut>();

    func.call(caller, input, (err, data) => {
        if (err) {
            outputSubject.error(err);
        } else {
            outputSubject.next(data);
        }
    });

    return outputSubject.asObservable();
}