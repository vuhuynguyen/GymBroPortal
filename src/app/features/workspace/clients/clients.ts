import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { InviteGymBroPanelService } from '../../../core/layout/invite-gymbro-panel/invite-gymbro-panel.service';
import { MessageService } from 'primeng/api';
import { ButtonComponent, ConfirmSplitDialogComponent, PageContainerComponent, PageHeaderComponent } from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { MemberDto } from '../workspace.model';
import { WorkspaceService } from '../workspace';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [PageContainerComponent, PageHeaderComponent, ButtonComponent, ConfirmSplitDialogComponent],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientsComponent {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);
  private readonly inviteGymBroPanel = inject(InviteGymBroPanelService);

  /** Stable workspace id — avoids refetching members on every tenants[] refresh when id unchanged. */
  private readonly ownWorkspaceId = computed(() => this.tenantService.ownTenant()?.id ?? null);

  constructor() {
    effect(() => {
      const id = this.ownWorkspaceId();
      if (!id) return;
      this.tenantService.selectOwnWorkspace();
      this.workspaceService.loadMembers(id);
    });
  }

  readonly loading = this.workspaceService.membersLoading;

  readonly clients = computed(() =>
    this.workspaceService.members().filter((m) => String(m.role).toLowerCase() === 'client')
  );

  readonly removeTarget = signal<MemberDto | null>(null);
  readonly removeInProgress = signal(false);

  readonly removeDialogMessage = computed(() => {
    const m = this.removeTarget();
    return m ? `Remove "${m.name}" as your client? They will lose access to your plans.` : '';
  });

  initial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  confirmRemove(client: MemberDto): void { this.removeTarget.set(client); }
  onDialogChange(open: boolean): void { if (!open) this.removeTarget.set(null); }

  onRemoveConfirmed(): void {
    const client = this.removeTarget();
    const tenant = this.tenantService.ownTenant();
    if (!client || !tenant) return;

    this.removeInProgress.set(true);
    this.workspaceService.removeMember(tenant.id, client.userId).subscribe({
      next: () => {
        this.removeInProgress.set(false);
        this.removeTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Removed', detail: `${client.name} removed.` });
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

  openInviteGymBroPanel(): void {
    this.inviteGymBroPanel.requestOpen();
  }
}
