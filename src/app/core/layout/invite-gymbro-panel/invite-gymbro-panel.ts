import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonComponent } from '../../../shared/ui';
import { WorkspaceService } from '../../../features/workspace/workspace';
import { InviteCodeDto } from '../../../features/workspace/workspace.model';

@Component({
  selector: 'app-invite-gymbro-panel',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './invite-gymbro-panel.html',
  styleUrls: ['../join-gymbro-panel/join-gymbro-panel.scss', './invite-gymbro-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InviteGymBroPanelComponent implements OnInit {
  readonly closed = output<void>();

  private readonly workspaceService = inject(WorkspaceService);
  private readonly messageService = inject(MessageService);

  readonly invites = this.workspaceService.invites;
  readonly loading = this.workspaceService.invitesLoading;
  readonly generateLoading = signal(false);

  readonly activeCode = computed<InviteCodeDto | null>(() =>
    this.invites().find((i) => !i.isUsed && !i.isExpired) ?? null
  );

  readonly expiresInDays = computed(() => {
    const code = this.activeCode();
    if (!code) return null;
    const diff = new Date(code.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  });

  ngOnInit(): void {
    this.workspaceService.loadInvites();
  }

  close(): void {
    this.closed.emit();
  }

  generate(): void {
    this.generateLoading.set(true);
    this.workspaceService.generateInvite().subscribe({
      next: () => {
        this.generateLoading.set(false);
        this.workspaceService.loadInvites();
      },
      error: (err: { error?: unknown }) => {
        this.generateLoading.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Failed to generate code.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  copy(): void {
    const code = this.activeCode()?.code;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      this.messageService.add({ severity: 'success', summary: 'Copied!', detail: `Code "${code}" copied.` });
    });
  }
}
