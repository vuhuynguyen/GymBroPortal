import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TenantService } from '../../tenant/tenant';
import { WorkspaceService } from '../../../features/workspace/workspace';

@Component({
  selector: 'app-join-gymbro-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './join-gymbro-panel.html',
  styleUrl: './join-gymbro-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JoinGymBroPanelComponent {
  readonly closed = output<void>();
  readonly joined = output<string>();

  private readonly workspaceService = inject(WorkspaceService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  readonly code = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  close(): void { this.closed.emit(); }

  submit(): void {
    const code = this.code().trim().toUpperCase();
    if (!code) { this.error.set('Please enter an invite code.'); return; }
    if (code.length !== 8) { this.error.set('Invite code must be 8 characters.'); return; }

    this.error.set('');
    this.loading.set(true);

    this.workspaceService.joinByCode(code).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Joined!', detail: 'You have joined the workspace.' });
        this.tenantService.loadTenants().subscribe(() => {
          this.tenantService.setActiveTenant(res.tenantId);
          this.joined.emit(res.tenantId);
          this.close();
        });
      },
      error: (err: { error?: unknown; status?: number }) => {
        this.loading.set(false);
        if (err.status === 404) { this.error.set('Invalid or expired invite code.'); return; }
        if (err.status === 409) { this.error.set('You are already a member of this workspace.'); return; }
        const msg = typeof err.error === 'string' ? err.error : 'Something went wrong. Please try again.';
        this.error.set(msg);
      }
    });
  }
}
