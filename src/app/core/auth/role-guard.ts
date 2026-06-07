import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { TenantService } from '../tenant/tenant';
import { TenantRole } from '../tenant/tenant.model';

export function adminGuard(): CanActivateFn {
  return () => {
    if (inject(AuthService).isPlatformAdmin()) return true;
    return inject(Router).createUrlTree(['/workspace/logs']);
  };
}

export function roleGuard(allowedRoles: TenantRole[]): CanActivateFn {
  return async () => {
    // inject() must run before the first await (injection context ends at the await).
    const tenant = inject(TenantService);
    const router = inject(Router);
    // Ensure tenants are loaded before reading the role — otherwise a deep-link/refresh to an
    // Owner-gated route evaluates currentRole() as null and wrongly redirects a legitimate Owner.
    await tenant.ensureLoaded();
    const role = tenant.currentRole();
    if (role && allowedRoles.includes(role)) return true;
    return router.createUrlTree(['/workspace/logs']);
  };
}
