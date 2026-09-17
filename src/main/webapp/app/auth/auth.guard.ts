import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** A session on this device is enough, valid token or not — see {@link AuthService.signedIn}. */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.signedIn()) {
    return true;
  }
  auth.signIn(state.url);
  return false;
};
