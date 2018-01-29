import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { AuthLayoutComponent } from './auth-layout/auth-layout.component';
import { RouterModule } from '@angular/router';
import { LoadingModalComponent } from './loading-modal/loading-modal.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NavigationContainerComponent } from './navigation-container/navigation-container.component';
import { NavigationComponent } from './navigation/navigation.component';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    NgbModule.forRoot()
  ],
  declarations: [AuthLayoutComponent, MainLayoutComponent, LoadingModalComponent, NavigationContainerComponent, NavigationComponent],
  entryComponents: [LoadingModalComponent]
})
export class LayoutModule { }
