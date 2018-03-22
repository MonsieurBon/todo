import { NgModule } from '@angular/core';
import { CommonModule as AngularCommonModule } from '@angular/common';
import { ReplacePipe } from './pipes/replace.pipe';
import { FilterPipe } from './pipes/filter.pipe';

@NgModule({
  imports: [
    AngularCommonModule
  ],
  declarations: [
    ReplacePipe,
    FilterPipe
  ],
  exports: [
    ReplacePipe,
    FilterPipe
  ]
})
export class CommonModule { }
