import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { InviteCodeDto, MemberDto } from './workspace.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);

  readonly members = signal<MemberDto[]>([]);
  readonly membersLoading = signal(false);

  readonly invites = signal<InviteCodeDto[]>([]);
  readonly invitesLoading = signal(false);

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
