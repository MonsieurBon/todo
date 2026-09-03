import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Lets anyone through who has a session on this device, valid token or not — see
 * {@link AuthService.signedIn}. Only someone with no session at all is sent to the IdP.
 */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.signedIn()) {
    return true;
  }
  auth.signIn(state.url);
  return false;
};
