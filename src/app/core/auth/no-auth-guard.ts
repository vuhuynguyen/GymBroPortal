import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

export const noAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.ready;
  if (!auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/']);
};
