import { NgModule } from '@angular/core';
import { CommonModule as AngularCommonModule } from '@angular/common';
import { ReplacePipe } from './pipes/replace.pipe';
import { FilterPipe } from './pipes/filter.pipe';
import { ClosePopoverOnOutsideClickDirective } from './directives/close-popover-on-outside-click.directive';

@NgModule({
  imports: [
    AngularCommonModule
  ],
  declarations: [
    ReplacePipe,
    FilterPipe,
    ClosePopoverOnOutsideClickDirective
  ],
  exports: [
    ReplacePipe,
    FilterPipe,
    ClosePopoverOnOutsideClickDirective
  ]
})
export class CommonModule { }
