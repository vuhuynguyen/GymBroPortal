import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AdminTenantDto, AdminUserDto } from './admin.model';
import { MemberDto } from '../workspace/workspace.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  readonly tenants = signal<AdminTenantDto[]>([]);
  readonly tenantsLoading = signal(false);

  readonly users = signal<AdminUserDto[]>([]);
  readonly usersLoading = signal(false);

  readonly tenantMembers = signal<MemberDto[]>([]);
  readonly tenantMembersLoading = signal(false);

  loadTenants(): void {
    this.tenantsLoading.set(true);
    this.http.get<AdminTenantDto[]>('/api/admin/tenants').subscribe({
      next: (data) => { this.tenants.set(data); this.tenantsLoading.set(false); },
      error: () => { this.tenantsLoading.set(false); }
    });
  }

  loadTenantMembers(tenantId: string): void {
    this.tenantMembersLoading.set(true);
    this.http.get<MemberDto[]>(`/api/admin/tenants/${tenantId}/members`).subscribe({
      next: (data) => { this.tenantMembers.set(data); this.tenantMembersLoading.set(false); },
      error: () => { this.tenantMembersLoading.set(false); }
    });
  }

  deleteTenant(tenantId: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/tenants/${tenantId}`);
  }

  removeMember(tenantId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/tenants/${tenantId}/members/${userId}`);
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.http.get<AdminUserDto[]>('/api/admin/users').subscribe({
      next: (data) => { this.users.set(data); this.usersLoading.set(false); },
      error: () => { this.usersLoading.set(false); }
    });
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/users/${userId}`);
  }

  promoteUser(email: string, isAdmin: boolean): Observable<void> {
    return this.http.post<void>('/api/admin/users/promote', { email, isAdmin });
  }
}
