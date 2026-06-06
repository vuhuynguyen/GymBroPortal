import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

/**
 * Ensures a JWT is present. Waits for the initial silent refresh to settle first — on a full page
 * reload the in-memory access token is restored from the refresh cookie before this resolves, so a
 * logged-in user isn't bounced to /login. Profile is loaded once by AuthService (not per navigation).
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
