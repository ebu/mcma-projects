import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
    selector: '[modal-content]'
})
export class ModalContentDirective {

    constructor(public viewContainerRef: ViewContainerRef) {}
}