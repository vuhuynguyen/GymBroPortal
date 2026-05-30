import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { MenuItem } from 'primeng/api';
import { MessageService } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Menu } from 'primeng/menu';
import {
  ButtonComponent,
  PageContainerComponent,
  PageHeaderComponent,
  ConfirmSplitDialogComponent
} from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { SessionService } from './session.service';
import type {
  ActiveSessionDto,
  SessionStatus,
  SessionSummaryDto,
  StartSessionRequest
} from './session.model';
import { StartSessionDialogComponent } from './start-session-dialog/start-session-dialog';

interface WeeklyStats {
  workouts: number;
  totalVolumeKg: number;
  avgDurationMinutes: number;
  totalSets: number;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: 'All' | SessionStatus; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Abandoned', label: 'Abandoned' },
  { value: 'InProgress', label: 'In progress' }
];

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PageContainerComponent,
    PageHeaderComponent,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    StartSessionDialogComponent,
    IconField,
    InputIcon,
    InputTextModule,
    Select,
    DatePicker,
    Menu,
    Tooltip
  ],
  templateUrl: './logs.html',
  styleUrl: './logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogsComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly statusOptions: Array<{ value: 'All' | SessionStatus; label: string }> = [...STATUS_OPTIONS];
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<'All' | SessionStatus>('All', { nonNullable: true });
  readonly fromControl = new FormControl<Date | null>(null);
  readonly toControl = new FormControl<Date | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly starting = signal(false);
  readonly startDialogOpen = signal(false);
  readonly abandonTarget = signal<SessionSummaryDto | null>(null);
  readonly dateRangeOpen = signal(false);

  readonly rowMenu = viewChild<Menu>('rowMenu');
  readonly rowMenuModel = signal<MenuItem[]>([]);

  readonly sessions = this.sessionService.sessions;
  readonly loading = this.sessionService.loading;
  readonly totalCount = this.sessionService.totalCount;
  readonly activeSession = this.sessionService.activeSession;

  readonly isOwner = computed(() => this.tenantService.currentRole() === 'Owner');

  /**
   * Unified hero session — used by both roles:
   * - trainee: own /active session
   * - either: first in-progress row in the list (e.g. owner monitoring a trainee)
   */
  readonly heroSession = computed(() => {
    const active = this.activeSession();
    if (active) {
      return {
        id: active.sessionId,
        title: this.activeWorkoutTitle(active),
        subtitle: active.source === 'FromAssignment' ? 'From assigned plan' : 'Ad-hoc workout',
        startedAt: active.startedAt,
        durationSeconds: Math.max(
          0,
          Math.floor((Date.now() - Date.parse(active.startedAt)) / 1000)
        ),
        exercises: active.exercises?.length ?? 0,
        completedSets:
          active.exercises?.reduce(
            (sum, e) => sum + e.sets.filter((s) => s.isCompleted).length,
            0
          ) ?? 0,
        totalSets: Math.max(
          active.snapshot?.exercises?.reduce((sum, e) => sum + e.sets.length, 0) ?? 0,
          active.exercises?.reduce((sum, e) => sum + e.sets.length, 0) ?? 0
        ),
        volumeKg:
          active.exercises?.reduce(
            (sum, e) =>
              sum +
              e.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
            0
          ) ?? 0,
        estCalories: Math.round(
          Math.max(0, (Date.now() - Date.parse(active.startedAt)) / 60000) * 8
        ),
        traineeName: null as string | null,
        canResume: true
      };
    }

    const inProgressRow = this.sessions().find(
      (s) => this.normalizeStatus(s.status) === 'InProgress'
    );
    if (!inProgressRow) return null;

    const startedMs = Date.parse(inProgressRow.startedAt);
    const durationSeconds = !Number.isNaN(startedMs)
      ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
      : inProgressRow.durationSeconds ?? 0;

    return {
      id: inProgressRow.id,
      title: inProgressRow.workoutName ?? 'Workout in progress',
      subtitle:
        inProgressRow.traineeName
          ? inProgressRow.traineeName
          : inProgressRow.source === 'FromAssignment'
            ? 'From assigned plan'
            : 'Ad-hoc workout',
      startedAt: inProgressRow.startedAt,
      durationSeconds,
      exercises: inProgressRow.totalExercises ?? 0,
      completedSets: inProgressRow.totalSets ?? 0,
      totalSets: inProgressRow.totalSets ?? 0,
      volumeKg: 0,
      estCalories: Math.round((durationSeconds / 60) * 8),
      traineeName: inProgressRow.traineeName,
      canResume: !this.isOwner() // owner monitors only; only the trainee can resume
    };
  });

  readonly heroProgressPercent = computed(() => {
    const h = this.heroSession();
    if (!h || !h.totalSets) return 0;
    return Math.min(100, Math.round((h.completedSets / h.totalSets) * 100));
  });

  readonly completedSessions = computed(() => {
    const heroId = this.heroSession()?.id;
    return this.sessions().filter((s) => s.id !== heroId);
  });

  readonly filteredSessions = computed(() => {
    const search = this.searchControl.value?.trim().toLowerCase() ?? '';
    if (!search) return this.completedSessions();
    return this.completedSessions().filter((s) => {
      const name = (s.workoutName ?? '').toLowerCase();
      const trainee = (s.traineeName ?? '').toLowerCase();
      return name.includes(search) || trainee.includes(search);
    });
  });

  readonly weeklyStats = computed<WeeklyStats>(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = this.sessions().filter((s) => {
      if (s.status !== 'Completed') return false;
      const t = Date.parse(s.startedAt);
      return !Number.isNaN(t) && t >= cutoff;
    });
    const totalSets = thisWeek.reduce((sum, s) => sum + (s.totalSets ?? 0), 0);
    const totalDuration = thisWeek.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    return {
      workouts: thisWeek.length,
      totalVolumeKg: 0,
      avgDurationMinutes: thisWeek.length > 0 ? Math.round(totalDuration / thisWeek.length / 60) : 0,
      totalSets
    };
  });

  /** Active-session inner stats — computed from snapshot + logged sets. */
  readonly activeStats = computed(() => {
    const a = this.activeSession();
    if (!a) return { exercises: 0, completedSets: 0, totalSets: 0, volumeKg: 0, estCalories: 0 };
    const exercises = a.exercises?.length ?? 0;
    const completedSets =
      a.exercises?.reduce((sum, e) => sum + e.sets.filter((s) => s.isCompleted).length, 0) ?? 0;
    const plannedSets =
      a.snapshot?.exercises?.reduce((sum, e) => sum + e.sets.length, 0) ?? 0;
    const performedSets = a.exercises?.reduce((sum, e) => sum + e.sets.length, 0) ?? 0;
    const totalSets = Math.max(plannedSets, performedSets);
    const volumeKg =
      a.exercises?.reduce(
        (sum, e) =>
          sum + e.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
        0
      ) ?? 0;
    const startedMs = Date.parse(a.startedAt);
    const elapsedMin = !Number.isNaN(startedMs)
      ? Math.max(0, (Date.now() - startedMs) / 60000)
      : 0;
    const estCalories = Math.round(elapsedMin * 8);
    return { exercises, completedSets, totalSets, volumeKg, estCalories };
  });

  readonly activeProgressPercent = computed(() => {
    const { completedSets, totalSets } = this.activeStats();
    return totalSets > 0 ? Math.min(100, Math.round((completedSets / totalSets) * 100)) : 0;
  });

  readonly totalPages = computed(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return total > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
  });

  readonly abandonDialogMessage = computed(() => {
    const t = this.abandonTarget();
    if (!t) return '';
    return `Abandon "${t.workoutName ?? 'this session'}"? You can still view it in the history afterwards.`;
  });

  ngOnInit(): void {
    this.refresh();
    this.sessionService.getActive().subscribe();
  }

  refresh(): void {
    this.sessionService
      .list({
        status: this.statusControl.value === 'All' ? undefined : this.statusControl.value,
        from: this.toIsoDate(this.fromControl.value),
        to: this.toIsoDate(this.toControl.value),
        page: this.page(),
        pageSize: this.pageSize()
      })
      .subscribe({
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Could not load sessions',
            detail: 'Please try again in a moment.'
          });
        }
      });
  }

  applyFilters(): void {
    this.page.set(1);
    this.refresh();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue('All');
    this.fromControl.setValue(null);
    this.toControl.setValue(null);
    this.applyFilters();
  }

  /** Date → "yyyy-MM-dd" for the API; undefined when blank. */
  private toIsoDate(d: Date | null | undefined): string | undefined {
    if (!d) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  startWorkout(): void {
    const active = this.activeSession();
    if (active) {
      void this.router.navigate(['/workspace/logs/session', active.sessionId]);
      return;
    }
    this.startDialogOpen.set(true);
  }

  onStartSessionConfirmed(payload: StartSessionRequest): void {
    this.starting.set(true);
    this.sessionService.start(payload).subscribe({
      next: (res) => {
        this.starting.set(false);
        this.startDialogOpen.set(false);
        this.messageService.add({ severity: 'success', summary: 'Workout started' });
        void this.router.navigate(['/workspace/logs/session', res.sessionId]);
      },
      error: (err) => {
        this.starting.set(false);
        const detail =
          err?.status === 409
            ? 'You already have a session in progress.'
            : 'Could not start session.';
        this.messageService.add({ severity: 'error', summary: 'Cannot start workout', detail });
      }
    });
  }

  resumeActive(): void {
    const active = this.activeSession();
    if (active) void this.router.navigate(['/workspace/logs/session', active.sessionId]);
  }

  resumeHero(sessionId: string): void {
    void this.router.navigate(['/workspace/logs/session', sessionId]);
  }

  viewSession(session: SessionSummaryDto): void {
    if (this.normalizeStatus(session.status) === 'InProgress') {
      void this.router.navigate(['/workspace/logs/session', session.id]);
    }
  }

  requestAbandon(session: SessionSummaryDto): void {
    this.abandonTarget.set(session);
  }

  openRowMenu(event: Event, session: SessionSummaryDto): void {
    const isInProgress = this.normalizeStatus(session.status) === 'InProgress';
    const items: MenuItem[] = [
      {
        label: isInProgress ? 'Open' : 'View details',
        icon: 'pi pi-eye',
        command: () => this.viewSession(session)
      }
    ];
    if (isInProgress) {
      items.push({
        separator: true
      });
      items.push({
        label: 'Abandon',
        icon: 'pi pi-times',
        styleClass: 'text-inv-error-300',
        command: () => this.requestAbandon(session)
      });
    }
    this.rowMenuModel.set(items);
    queueMicrotask(() => this.rowMenu()?.toggle(event));
  }

  requestAbandonActive(): void {
    const active = this.activeSession();
    if (!active) return;
    this.abandonTarget.set({
      id: active.sessionId,
      traineeId: '',
      traineeName: null,
      source: active.source,
      status: active.status,
      startedAt: active.startedAt,
      completedAt: null,
      durationSeconds: 0,
      totalSets: 0,
      totalExercises: active.exercises?.length ?? 0,
      rpeOverall: null,
      planAssignmentId: active.planAssignmentId ?? null,
      workoutName: this.activeWorkoutTitle(active)
    });
  }

  onAbandonDialogOpenChange(open: boolean): void {
    if (!open) this.abandonTarget.set(null);
  }

  onAbandonConfirmed(): void {
    const target = this.abandonTarget();
    if (!target) return;
    this.sessionService.abandon(target.id).subscribe({
      next: () => {
        this.abandonTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Session abandoned' });
        this.refresh();
        this.sessionService.getActive().subscribe();
      },
      error: () => {
        this.abandonTarget.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not abandon session'
        });
      }
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.refresh();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.refresh();
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    const mins = Math.round(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
  }

  formatStartedAt(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (date.toDateString() === today.toDateString()) return `Today · ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` · ${time}`;
  }

  activeDurationLabel(active: ActiveSessionDto | null): string {
    if (!active) return '';
    const startedMs = Date.parse(active.startedAt);
    if (Number.isNaN(startedMs)) return '';
    const minutes = Math.max(0, Math.round((Date.now() - startedMs) / 60000));
    return this.formatDuration(minutes * 60);
  }

  activeWorkoutTitle(active: ActiveSessionDto | null): string {
    if (!active) return '';
    return active.workoutNameSnapshot || active.snapshot?.workoutName || 'Workout in progress';
  }

  /** Normalize whatever the API sends ('completed', 'Completed', 'COMPLETED'…) to PascalCase. */
  private normalizeStatus(status: SessionStatus | string | null | undefined): SessionStatus {
    const s = String(status ?? '').toLowerCase();
    if (s === 'inprogress' || s === 'in_progress' || s === 'in progress') return 'InProgress';
    if (s === 'abandoned') return 'Abandoned';
    return 'Completed';
  }

  statusBadgeClass(status: SessionStatus | string): string {
    switch (this.normalizeStatus(status)) {
      case 'Completed':
        return 'bg-inv-success-0 text-inv-success-300';
      case 'Abandoned':
        return 'bg-inv-grey-0 text-inv-grey-700';
      case 'InProgress':
        return 'bg-inv-primary-0 text-inv-primary-700';
    }
  }

  statusDotClass(status: SessionStatus | string): string {
    switch (this.normalizeStatus(status)) {
      case 'Completed':
        return 'bg-inv-success-300';
      case 'Abandoned':
        return 'bg-inv-grey-400';
      case 'InProgress':
        return 'bg-inv-primary-500';
    }
  }

  statusLabel(status: SessionStatus | string): string {
    const norm = this.normalizeStatus(status);
    return norm === 'InProgress' ? 'In progress' : norm;
  }

  trackById(_index: number, item: SessionSummaryDto): string {
    return item.id;
  }
}
