import { ApplicationConfig, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { OAuthStorage, provideOAuthClient } from 'angular-oauth2-oidc';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { authInterceptor } from './auth/auth.interceptor';
import { provideIcons } from './core/icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideIcons(),
    provideOAuthClient(),
    // sessionStorage, the library's default, means a login every time the phone reclaims the
    // process. localStorage is readable by an injected script: accepted cost for a personal app.
    { provide: OAuthStorage, useFactory: () => localStorage },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Registering immediately would compete with the first board request for the connection.
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Blocks the first render: a flash of the signed-out shell is worse than a moment of nothing.
    provideAppInitializer(() => inject(AuthService).bootstrap()),
  ],
};
