import { Directive, HostListener, ElementRef, ComponentRef } from '@angular/core';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';
import { NgbPopoverWindow } from '@ng-bootstrap/ng-bootstrap/popover/popover';

@Directive({
  selector: '[appClosePopoverOnOutsideClick][ngbPopover]'
})
export class ClosePopoverOnOutsideClickDirective {

  constructor(private elementRef: ElementRef,
              private ngbPopover: NgbPopover) {

  }

  @HostListener('document:click', ['$event'])
  private documentClicked(event: MouseEvent): void {

    // Popover is open
    if (this.ngbPopover && this.ngbPopover.isOpen()) {

      // Not clicked on self element
      if (!this.elementRef.nativeElement.contains(event.target)) {

        // Hacking typescript to access private member
        const popoverWindowRef: ComponentRef<NgbPopoverWindow> = (this.ngbPopover as any)._windowRef;

        // If clicked outside popover window
        if (!popoverWindowRef.location.nativeElement.contains(event.target)) {
          this.ngbPopover.close();
        }
      }
    }
  }
}
