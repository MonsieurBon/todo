import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Only `/api` is touched: the metadata document is deliberately anonymous, and a token on anything
 * else leaks it to whatever the app happens to fetch. An expired token gets one renewal.
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
      if (error.status !== 401 && error.status !== 403) {
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
