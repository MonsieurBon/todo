import { RouterModule, Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout.component';
import { ModuleWithProviders } from '@angular/core';
import { AuthGuard } from './auth/auth-guard.service';

const appRoutes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'tasklist', pathMatch: 'full' },
      { path: 'tasklist', loadChildren: 'app/tasklist/tasklist.module#TasklistModule' }
    ]
  },
  { path: 'auth', component: AuthLayoutComponent, loadChildren: 'app/auth/auth.module#AuthModule' },
  { path: '**', redirectTo: 'home' }
];

export const appRouting: ModuleWithProviders = RouterModule.forRoot(appRoutes);
