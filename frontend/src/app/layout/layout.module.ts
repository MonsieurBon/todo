import { NgModule } from '@angular/core';
import { CommonModule as AngularCommonModule } from '@angular/common';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { AuthLayoutComponent } from './auth-layout/auth-layout.component';
import { RouterModule } from '@angular/router';
import { LoadingModalComponent } from './loading-modal/loading-modal.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NewTaskButtonComponent } from './new-task-button/new-task-button.component';
import { NavbarComponent } from './navbar/navbar.component';
import { NavbarContainerComponent } from './navbar-container/navbar-container.component';
import { NewTaskComponent } from './new-task/new-task.component';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '../common/common.module';
import { FilterOptionsContainerComponent } from './filter-options-container/filter-options-container.component';
import { FilterOptionsComponent } from './filter-options/filter-options.component';

@NgModule({
  imports: [
    AngularCommonModule,
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    NgbModule.forRoot()
  ],
  declarations: [
    AuthLayoutComponent,
    MainLayoutComponent,
    LoadingModalComponent,
    NewTaskButtonComponent,
    NewTaskComponent,
    NavbarComponent,
    NavbarContainerComponent,
    FilterOptionsContainerComponent,
    FilterOptionsComponent
  ],
  entryComponents: [LoadingModalComponent, NewTaskComponent]
})
export class LayoutModule { }
