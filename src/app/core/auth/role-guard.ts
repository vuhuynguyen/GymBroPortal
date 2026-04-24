import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { TenantService } from '../tenant/tenant';
import { TenantRole } from '../tenant/tenant.model';

export function adminGuard(): CanActivateFn {
  return () => {
    if (inject(AuthService).isPlatformAdmin()) return true;
    return inject(Router).createUrlTree(['/']);
  };
}

export function roleGuard(allowedRoles: TenantRole[]): CanActivateFn {
  return () => {
    const role = inject(TenantService).currentRole();
    if (role && allowedRoles.includes(role)) return true;
    return inject(Router).createUrlTree(['/']);
  };
}
