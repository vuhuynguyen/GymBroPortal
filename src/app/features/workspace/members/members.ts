import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  PageContainerComponent,
  PageHeaderComponent,
  type TableColumn
} from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { InviteCodeDto, MemberDto } from '../workspace.model';
import { WorkspaceService } from '../workspace';

type Tab = 'clients' | 'invites';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    DataTableComponent,
    DataTableCellTemplateDirective,
    ButtonComponent,
    ConfirmSplitDialogComponent
  ],
  templateUrl: './members.html',
  styleUrl: './members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersComponent {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  private readonly ownWorkspaceId = computed(() => this.tenantService.ownTenant()?.id ?? null);

  constructor() {
    effect(() => {
      const id = this.ownWorkspaceId();
      if (!id) return;
      this.workspaceService.loadMembers(id);
      this.workspaceService.loadInvites();
    });
  }

  readonly members = this.workspaceService.members;
  readonly membersLoading = this.workspaceService.membersLoading;
  readonly invites = this.workspaceService.invites;
  readonly invitesLoading = this.workspaceService.invitesLoading;

  readonly activeTab = signal<Tab>('clients');
  readonly generateLoading = signal(false);
  readonly removeTarget = signal<MemberDto | null>(null);
  readonly removeInProgress = signal(false);
  readonly revokeTarget = signal<InviteCodeDto | null>(null);
  readonly revokeInProgress = signal(false);

  readonly removeDialogMessage = computed(() => {
    const m = this.removeTarget();
    return m ? `Remove "${m.name}" as your client? They will lose access immediately.` : '';
  });

  readonly revokeDialogMessage = computed(() => {
    const i = this.revokeTarget();
    return i ? `Revoke code "${i.code}"? It will no longer work for joining.` : '';
  });

  /** Clients only (exclude self/owner row) */
  readonly clients = computed(() =>
    this.members().filter((m) => String(m.role).toLowerCase() === 'client')
  );

  readonly clientColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'joinedAt', header: 'Joined', type: 'custom' },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  readonly inviteColumns: TableColumn[] = [
    { field: 'code', header: 'Code', type: 'custom' },
    { field: 'createdAt', header: 'Created', type: 'custom' },
    { field: 'expiresAt', header: 'Expires', type: 'custom' },
    { field: 'isUsed', header: 'Status', type: 'custom' },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  generateInvite(): void {
    this.generateLoading.set(true);
    this.workspaceService.generateInvite().subscribe({
      next: () => {
        this.generateLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Generated', detail: 'New invite code created.' });
        this.workspaceService.loadInvites();
        this.activeTab.set('invites');
      },
      error: (err: { error?: unknown }) => {
        this.generateLoading.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to generate invite code.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.messageService.add({ severity: 'success', summary: 'Copied', detail: `Code "${code}" copied to clipboard.` });
    });
  }

  confirmRemove(member: MemberDto): void { this.removeTarget.set(member); }
  onRemoveDialogChange(open: boolean): void { if (!open) this.removeTarget.set(null); }

  onRemoveConfirmed(): void {
    const member = this.removeTarget();
    const tenant = this.tenantService.ownTenant();
    if (!member || !tenant) return;

    this.removeInProgress.set(true);
    this.workspaceService.removeMember(tenant.id, member.userId).subscribe({
      next: () => {
        this.removeInProgress.set(false);
        this.removeTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Removed', detail: `${member.name} removed.` });
        this.workspaceService.loadMembers(tenant.id);
        this.tenantService.loadTenants().subscribe();
      },
      error: (err: { error?: unknown }) => {
        this.removeInProgress.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to remove client.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  confirmRevoke(invite: InviteCodeDto): void { this.revokeTarget.set(invite); }
  onRevokeDialogChange(open: boolean): void { if (!open) this.revokeTarget.set(null); }

  onRevokeConfirmed(): void {
    const invite = this.revokeTarget();
    if (!invite) return;

    this.revokeInProgress.set(true);
    this.workspaceService.revokeInvite(invite.code).subscribe({
      next: () => {
        this.revokeInProgress.set(false);
        this.revokeTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Revoked', detail: `Code "${invite.code}" revoked.` });
        this.workspaceService.loadInvites();
      },
      error: (err: { error?: unknown }) => {
        this.revokeInProgress.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to revoke invite.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

}
