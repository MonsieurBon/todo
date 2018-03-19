import { NgModule } from '@angular/core';
import { CommonModule as AngularCommonModule } from '@angular/common';
import { ReplacePipe } from './pipes/replace.pipe';

@NgModule({
  imports: [
    AngularCommonModule
  ],
  declarations: [
    ReplacePipe
  ],
  exports: [
    ReplacePipe
  ]
})
export class CommonModule { }
