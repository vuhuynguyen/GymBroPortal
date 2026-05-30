import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const messages = inject(MessageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Expired/invalid token: clear session and bounce to login.
        auth.logout();
      } else {
        messages.add({
          severity: 'error',
          summary: 'Something went wrong',
          detail: err.error?.message ?? err.message ?? 'Request failed'
        });
      }
      return throwError(() => err);
    })
  );
};
