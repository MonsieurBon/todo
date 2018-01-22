import { RouterModule, Routes } from '@angular/router';
import { TasklistPageComponent } from './tasklist-page/tasklist-page.component';
import { ModuleWithProviders } from '@angular/core';

const tasklistsRoutes: Routes = [
  {
    path: '',
    component: TasklistPageComponent
  }
];

export const tasklistRouting: ModuleWithProviders = RouterModule.forChild(tasklistsRoutes);
