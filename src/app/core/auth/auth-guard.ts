import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { TenantService } from '../tenant/tenant';

/**
 * Ensures a JWT is present. Waits for the initial silent refresh to settle first — on a full page
 * reload the in-memory access token is restored from the refresh cookie before this resolves, so a
 * logged-in user isn't bounced to /login. Profile is loaded once by AuthService (not per navigation).
 * Once authenticated, eagerly loads tenants (once) so every shell route — including the Owner-gated
 * children behind roleGuard — sees a populated role before activation.
 */
export const authGuard: CanActivateFn = async () => {
  // inject() must run before the first await (injection context ends at the await).
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenant = inject(TenantService);

  await auth.ready;

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);

  await tenant.ensureLoaded();
  return true;
};
