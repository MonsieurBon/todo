import { RouterModule, Routes } from '@angular/router';
import { TasklistPageComponent } from './components/tasklist-page/tasklist-page.component';
import { ModuleWithProviders } from '@angular/core';

const tasklistsRoutes: Routes = [
  {
    path: ':name',
    component: TasklistPageComponent
  },
  {
    path: '',
    component: TasklistPageComponent
  }
];

export const tasklistRouting: ModuleWithProviders = RouterModule.forChild(tasklistsRoutes);
