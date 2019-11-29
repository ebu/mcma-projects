import { Component, ViewChild, ComponentFactoryResolver, AfterViewInit, HostListener } from '@angular/core';

import { ModalContentDirective } from '../directives/modal-content.directive';
import { ModalService } from '../services/modal.service';

@Component({
  selector: 'mcma-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent implements AfterViewInit {

  static readonly escapeKeyCode = 27;
  
  isShowing = false;
  @ViewChild(ModalContentDirective) modalContent: ModalContentDirective;

  constructor(private modalService: ModalService, private componentFactoryResolver: ComponentFactoryResolver) {
  }

  ngAfterViewInit(): void {
    this.modalService.currentModal$.subscribe(modal => {
      if (this.modalContent) {
        // clear any existing content
        this.modalContent.viewContainerRef.clear();

        // if we have new content, show it now
        if (modal && modal.componentType) {
          const componentRef =
            this.modalContent.viewContainerRef.createComponent(
              this.componentFactoryResolver.resolveComponentFactory(modal.componentType));
          
          if (modal.data) {
            Object.keys(modal.data).forEach(k => componentRef.instance[k] = modal.data[k]);
          }

          this.isShowing = true;
        } else {
          this.isShowing = false;
        }
      }
    });
  }
  
  @HostListener('document:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    if (event.keyCode === ModalComponent.escapeKeyCode) {
      this.modalService.clearModal();
    }
  }
}
