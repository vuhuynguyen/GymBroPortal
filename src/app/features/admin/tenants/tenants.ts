import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
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
  type TableColumn,
  type TableTagSeverity
} from '../../../shared/ui';
import { AdminTenantDto } from '../admin.model';
import { AdminService } from '../admin';
import { MemberDto } from '../../workspace/workspace.model';

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    DataTableComponent,
    DataTableCellTemplateDirective,
    ButtonComponent,
    ConfirmSplitDialogComponent
  ],
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly messageService = inject(MessageService);

  readonly tenants = this.adminService.tenants;
  readonly loading = this.adminService.tenantsLoading;
  readonly tenantMembers = this.adminService.tenantMembers;
  readonly membersLoading = this.adminService.tenantMembersLoading;

  readonly selectedTenant = signal<AdminTenantDto | null>(null);
  readonly deleteTarget = signal<AdminTenantDto | null>(null);
  readonly deleteInProgress = signal(false);
  readonly removeMemberTarget = signal<{ member: MemberDto; tenantId: string } | null>(null);
  readonly removeMemberInProgress = signal(false);

  readonly deleteDialogMessage = computed(() => {
    const t = this.deleteTarget();
    return t ? `Permanently delete workspace "${t.name}" and all its members?` : '';
  });

  readonly removeMemberDialogMessage = computed(() => {
    const r = this.removeMemberTarget();
    return r ? `Remove "${r.member.name}" from this workspace?` : '';
  });

  readonly tenantColumns: TableColumn[] = [
    { field: 'name', header: 'Workspace', type: 'custom', filter: true, filterType: 'text' },
    { field: 'ownerName', header: 'Owner', filter: true, filterType: 'text' },
    { field: 'memberCount', header: 'Members' },
    { field: 'createdOnUtc', header: 'Created', type: 'custom' },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  readonly memberColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'role', header: 'Role', type: 'tag',
      tagSeverityResolver: (v): TableTagSeverity => v === 'Owner' ? 'contrast' : 'secondary'
    },
    { field: 'joinedAt', header: 'Joined', type: 'custom' },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  ngOnInit(): void {
    this.adminService.loadTenants();
  }

  viewMembers(tenant: AdminTenantDto): void {
    this.selectedTenant.set(tenant);
    this.adminService.loadTenantMembers(tenant.id);
  }

  backToTenants(): void {
    this.selectedTenant.set(null);
  }

  confirmDelete(tenant: AdminTenantDto): void {
    this.deleteTarget.set(tenant);
  }

  onDeleteDialogOpenChange(open: boolean): void {
    if (!open) this.deleteTarget.set(null);
  }

  onDeleteConfirmed(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.deleteInProgress.set(true);
    this.adminService.deleteTenant(t.id).subscribe({
      next: () => {
        this.deleteInProgress.set(false);
        this.deleteTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Workspace "${t.name}" deleted.` });
        this.adminService.loadTenants();
      },
      error: (err: { error?: unknown }) => {
        this.deleteInProgress.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to delete workspace.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  confirmRemoveMember(member: MemberDto): void {
    const tenant = this.selectedTenant();
    if (!tenant) return;
    this.removeMemberTarget.set({ member, tenantId: tenant.id });
  }

  onRemoveMemberDialogOpenChange(open: boolean): void {
    if (!open) this.removeMemberTarget.set(null);
  }

  onRemoveMemberConfirmed(): void {
    const r = this.removeMemberTarget();
    if (!r) return;
    this.removeMemberInProgress.set(true);
    this.adminService.removeMember(r.tenantId, r.member.userId).subscribe({
      next: () => {
        this.removeMemberInProgress.set(false);
        this.removeMemberTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Removed', detail: `${r.member.name} removed.` });
        this.adminService.loadTenantMembers(r.tenantId);
      },
      error: (err: { error?: unknown }) => {
        this.removeMemberInProgress.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to remove member.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
