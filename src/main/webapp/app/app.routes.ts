import { Routes } from '@angular/router';
import { signedInGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'To-Do',
    loadComponent: () => import('./board/board-page').then((m) => m.BoardPage),
    canActivate: [signedInGuard],
  },
  {
    // Also the Web Share Target: Android hands over ?title=&text=&url= here.
    path: 'capture',
    title: 'Capture',
    loadComponent: () => import('./capture/capture-page').then((m) => m.CapturePage),
    canActivate: [signedInGuard],
  },
  {
    path: 'review',
    title: 'Review sweep',
    loadComponent: () => import('./review/review-page').then((m) => m.ReviewPage),
    canActivate: [signedInGuard],
  },
  {
    path: 'lists',
    title: 'Lists',
    loadComponent: () => import('./lists/lists-page').then((m) => m.ListsPage),
    canActivate: [signedInGuard],
  },
  { path: '**', redirectTo: '' },
];
