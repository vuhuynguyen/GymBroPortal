import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { TenantService } from '../../core/tenant/tenant';
import { InviteCodeDto, MemberDto } from './workspace.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  readonly members = signal<MemberDto[]>([]);
  readonly membersLoading = signal(false);

  readonly invites = signal<InviteCodeDto[]>([]);
  readonly invitesLoading = signal(false);

  constructor() {
    // Members and invites are tenant-scoped; clear them when the active workspace changes so a switch
    // never shows the previous tenant's roster/invites. Skips the initial run (nothing to clear yet).
    let first = true;
    effect(() => {
      this.tenantService.activeTenantId();
      if (first) {
        first = false;
        return;
      }
      this.reset();
    });
  }

  /** Clear cached members + invites. Invoked automatically on a tenant switch. */
  reset(): void {
    this.members.set([]);
    this.membersLoading.set(false);
    this.invites.set([]);
    this.invitesLoading.set(false);
  }

  loadMembers(tenantId: string): void {
    this.membersLoading.set(true);
    this.http.get<MemberDto[]>(`/api/tenants/${tenantId}/members`).subscribe({
      next: (data) => { this.members.set(data); this.membersLoading.set(false); },
      error: () => { this.membersLoading.set(false); }
    });
  }

  removeMember(tenantId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`/api/tenants/${tenantId}/members/${userId}`);
  }

  loadInvites(): void {
    this.invitesLoading.set(true);
    this.http.get<InviteCodeDto[]>('/api/invites').subscribe({
      next: (data) => { this.invites.set(data); this.invitesLoading.set(false); },
      error: () => { this.invitesLoading.set(false); }
    });
  }

  generateInvite(): Observable<{ code: string }> {
    return this.http.post<{ code: string }>('/api/invites/generate', {});
  }

  revokeInvite(code: string): Observable<void> {
    return this.http.delete<void>(`/api/invites/${code}`);
  }

  joinByCode(code: string): Observable<{ tenantId: string }> {
    return this.http.post<{ tenantId: string }>('/api/invites/join', { code });
  }
}
