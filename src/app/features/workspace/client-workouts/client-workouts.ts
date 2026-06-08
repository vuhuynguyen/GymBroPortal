import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { WorkspaceService } from '../workspace';
import { SessionService } from '../logs/session.service';
import { SessionDetailDialogComponent } from '../logs/session-detail-dialog/session-detail-dialog';
import type { SessionDetailDto, SessionStatus, SessionSummaryDto } from '../logs/session.model';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Coach view of one client's training history. Reads the client's sessions tenant-scoped from the coach's
 * own gym (`GET /api/sessions?traineeId=…`, gated by `WorkoutLogViewAll`) and reuses the session-detail
 * dialog for per-session detail. Read-only — a coach cannot start/abandon a client's session.
 */
@Component({
  selector: 'app-client-workouts',
  standalone: true,
  imports: [
    CommonModule,
    PageContainerComponent,
    PageHeaderComponent,
    ButtonComponent,
    SessionDetailDialogComponent
  ],
  templateUrl: './client-workouts.html',
  styleUrl: './client-workouts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientWorkoutsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly tenantService = inject(TenantService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly messageService = inject(MessageService);

  private readonly clientId = signal<string>('');
  readonly sessions = signal<SessionSummaryDto[]>([]);
  readonly loading = signal(false);

  readonly selectedSession = signal<SessionDetailDto | null>(null);
  readonly detailLoading = signal(false);
  readonly detailOpen = signal(false);

  readonly clientName = computed(() => {
    const id = this.clientId();
    return this.workspaceService.members().find((m) => m.userId === id)?.name ?? 'Client';
  });

  readonly subtitle = computed(() => {
    const n = this.sessions().length;
    return n > 0 ? `${n} session${n === 1 ? '' : 's'}` : 'No sessions yet';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.clientId.set(id);

    // The client's sessions live in the coach's own gym → ensure that tenant is the active context.
    this.tenantService.selectOwnWorkspace();
    const ownId = this.tenantService.ownTenant()?.id;
    if (ownId) this.workspaceService.loadMembers(ownId);

    if (id) this.load(id);
  }

  private load(clientId: string): void {
    this.loading.set(true);
    this.sessionService.listForClient(clientId).subscribe({
      next: (res) => {
        this.sessions.set(res.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load workouts' });
      }
    });
  }

  back(): void {
    void this.router.navigate(['/workspace/clients']);
  }

  openSession(session: SessionSummaryDto): void {
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.selectedSession.set(null);
    this.sessionService.getById(session.id).subscribe({
      next: (detail) => {
        this.selectedSession.set(detail);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailOpen.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load session details' });
      }
    });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedSession.set(null);
  }

  // ── Presentation helpers (API enums are camelCase) ───────────────────────
  workoutTitle(session: SessionSummaryDto): string {
    if (this.isAdhoc(session.source)) return 'Ad-hoc workout';
    return session.workoutName?.trim() || session.programName?.trim() || 'Workout';
  }

  sourceTag(session: SessionSummaryDto): string {
    if (this.isAdhoc(session.source)) return 'Ad-hoc';
    const program = session.programName?.trim();
    return program ? program : 'Plan';
  }

  statusLabel(session: SessionSummaryDto): string {
    return this.normalizeStatus(session.status);
  }

  statusClass(session: SessionSummaryDto): string {
    return this.normalizeStatus(session.status).toLowerCase();
  }

  formatVolume(kg: number): string {
    if (!kg) return '0';
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
    return Math.round(kg).toString();
  }

  relativeDay(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfDate) / MS_PER_DAY);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  trackById(_index: number, item: SessionSummaryDto): string {
    return item.id;
  }

  private isAdhoc(source: string | null | undefined): boolean {
    return String(source ?? '').toLowerCase() === 'adhoc';
  }

  private normalizeStatus(status: SessionStatus | string | null | undefined): SessionStatus {
    const s = String(status ?? '').toLowerCase();
    if (s === 'inprogress') return 'InProgress';
    if (s === 'abandoned') return 'Abandoned';
    return 'Completed';
  }
}
