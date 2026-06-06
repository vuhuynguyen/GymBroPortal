import { Injectable } from '@angular/core';
import { TenantRole } from '../tenant/tenant.model';
import { Permission } from './permission.model';

// Mirrors PermissionService.HasPermission on the backend exactly.
const OWNER_PERMISSIONS = new Set<Permission>([
  'PlanCreate', 'PlanUpdate', 'PlanDelete', 'PlanAssign', 'PlanView', 'PlanViewAll',
  'ClientView', 'ClientRemove', 'InviteCreate',
  'WorkoutLogCreate', 'WorkoutLogViewOwn', 'WorkoutLogViewAll',
]);

const CLIENT_PERMISSIONS = new Set<Permission>([
  'PlanView', 'ClientView', 'WorkoutLogCreate', 'WorkoutLogViewOwn',
]);

@Injectable({ providedIn: 'root' })
export class PermissionService {
  hasPermission(role: TenantRole | null, permission: Permission): boolean {
    if (!role) return false;
    return role === 'Owner'
      ? OWNER_PERMISSIONS.has(permission)
      : CLIENT_PERMISSIONS.has(permission);
  }
}
