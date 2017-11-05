import { RouterModule, Routes } from '@angular/router';
import { TasklistComponent } from './tasklist/tasklist.component';
import { ModuleWithProviders } from '@angular/core';

const tasklistRoutes: Routes = [
  {
    path: '',
    component: TasklistComponent
  }
];

export const tasklistRouting: ModuleWithProviders = RouterModule.forChild(tasklistRoutes);
