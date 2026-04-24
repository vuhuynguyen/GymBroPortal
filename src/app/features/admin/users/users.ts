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
  type TableColumn
} from '../../../shared/ui';
import { AdminUserDto } from '../admin.model';
import { AdminService } from '../admin';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    DataTableComponent,
    DataTableCellTemplateDirective,
    ButtonComponent,
    ConfirmSplitDialogComponent
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly messageService = inject(MessageService);

  readonly users = this.adminService.users;
  readonly loading = this.adminService.usersLoading;

  readonly deleteTarget = signal<AdminUserDto | null>(null);
  readonly deleteInProgress = signal(false);

  readonly deleteDialogMessage = computed(() => {
    const u = this.deleteTarget();
    return u ? `Permanently delete user "${u.name}" and all their data?` : '';
  });

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'createdOnUtc', header: 'Joined', type: 'custom' },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  ngOnInit(): void {
    this.adminService.loadUsers();
  }

  confirmDelete(user: AdminUserDto): void {
    this.deleteTarget.set(user);
  }

  onDeleteDialogOpenChange(open: boolean): void {
    if (!open) this.deleteTarget.set(null);
  }

  onDeleteConfirmed(): void {
    const u = this.deleteTarget();
    if (!u) return;
    this.deleteInProgress.set(true);
    this.adminService.deleteUser(u.id).subscribe({
      next: () => {
        this.deleteInProgress.set(false);
        this.deleteTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `User "${u.name}" deleted.` });
        this.adminService.loadUsers();
      },
      error: (err: { error?: unknown }) => {
        this.deleteInProgress.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to delete user.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
