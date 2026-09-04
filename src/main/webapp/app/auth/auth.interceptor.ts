import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Attaches the bearer token to API calls, and gives an expired one exactly one chance to renew.
 *
 * <p>Only {@code /api} requests are touched. The metadata document is deliberately anonymous, and
 * sending a token to anything else would leak it to whatever else the app happens to fetch.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api')) {
    return next(request);
  }
  const auth = inject(AuthService);
  const authorized = (token: string | null) =>
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authorized(auth.accessToken())).pipe(
    catchError((error: { status?: number }) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }
      return from(auth.tryRefresh()).pipe(
        switchMap((renewed) =>
          renewed ? next(authorized(auth.accessToken())) : throwError(() => error),
        ),
      );
    }),
  );
};
