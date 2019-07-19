import { Injectable, Type } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable()
export class ModalService {
    private currentModalSubject = new BehaviorSubject<{ componentType: Type<any>, data: any }>({ componentType: null, data: null });
    currentModal$ = this.currentModalSubject.asObservable();

    showModal(componentType: Type<any>, data: any = null): void {
        this.currentModalSubject.next({ componentType, data });
    }

    clearModal(data: any = null): void {
        this.currentModalSubject.next({ componentType: null, data });
    }
}