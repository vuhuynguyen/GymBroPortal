import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth';

// Auth endpoints manage their own 401s — never try to silent-refresh these (the refresh call itself
// 401ing must not recurse into another refresh).
const AUTH_ENDPOINTS = [
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout'
];

function withAccessToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const messages = inject(MessageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthCall = AUTH_ENDPOINTS.some((url) => req.url.includes(url));

      // Access token expired on a normal API call: silently refresh once, then replay the request.
      if (err.status === 401 && !isAuthCall) {
        return auth.refresh().pipe(
          switchMap((token) => next(withAccessToken(req, token))),
          catchError((refreshErr) => {
            // Refresh failed → session is truly gone. Bounce to login.
            auth.logout();
            return throwError(() => refreshErr);
          })
        );
      }

      // Let auth calls surface their own 401 to the caller without a toast.
      if (err.status === 401) {
        return throwError(() => err);
      }

      messages.add({
        severity: 'error',
        summary: 'Something went wrong',
        detail: err.error?.message ?? err.message ?? 'Request failed'
      });
      return throwError(() => err);
    })
  );
};
