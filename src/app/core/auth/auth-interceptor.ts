import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth';
import { TenantService } from '../tenant/tenant';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (!token) return next(req);

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const tenants = inject(TenantService);
  // Prefer resolved tenant; fall back to stored id so requests work before /api/tenants/mine finishes.
  const tenantId = tenants.activeTenant()?.id ?? tenants.activeTenantId() ?? undefined;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  return next(req.clone({ setHeaders: headers }));
};
