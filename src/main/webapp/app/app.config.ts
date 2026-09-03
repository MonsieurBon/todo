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
    // Tokens survive the app being closed. sessionStorage — the library's default — would mean a
    // login every time the phone reclaims the process, which for a task list is every time.
    // localStorage is readable by any script that gets injected; that is the accepted cost of a
    // personal app not asking for a password twice a day.
    { provide: OAuthStorage, useFactory: () => localStorage },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Registering immediately would compete with the first board request for the connection.
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Blocks the first render: every route needs to know whether there is a session, and a flash
    // of the signed-out shell before the stored token is read is worse than a moment of nothing.
    provideAppInitializer(() => inject(AuthService).bootstrap()),
  ],
};
