import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonComponent, PageContainerComponent, PageHeaderComponent } from '../../../shared/ui';
import { WorkspaceService } from '../workspace';
import { InviteCodeDto } from '../workspace.model';

@Component({
  selector: 'app-invite',
  standalone: true,
  imports: [PageContainerComponent, PageHeaderComponent, ButtonComponent],
  templateUrl: './invite.html',
  styleUrl: './invite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InviteComponent implements OnInit {
  /** When true, omit page header (e.g. shell side panel provides its own title). */
  readonly embedded = input(false);

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
