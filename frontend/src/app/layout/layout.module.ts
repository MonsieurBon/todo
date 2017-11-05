import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { RouterModule } from '@angular/router';
import { NavigationComponent } from './navigation/navigation.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthLayoutComponent } from './auth-layout/auth-layout.component';
import { LoadingModalComponent } from './loading-modal/loading-modal.component';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    NgbModule
  ],
  declarations: [AuthLayoutComponent, MainLayoutComponent, NavigationComponent, LoadingModalComponent],
  entryComponents: [LoadingModalComponent]
})
export class LayoutModule { }
