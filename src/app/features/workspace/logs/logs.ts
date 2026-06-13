import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { DatePicker } from 'primeng/datepicker';
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
  SessionDetailDto,
  SessionStatus,
  SessionSummaryDto,
  StartSessionRequest
} from './session.model';
import { StartSessionDialogComponent } from './start-session-dialog/start-session-dialog';
import { CompletionRingComponent } from './completion-ring/completion-ring';
import { SessionDetailDialogComponent } from './session-detail-dialog/session-detail-dialog';

type FilterId = 'all' | 'programs' | 'adhoc' | 'pr';

interface FilterChip {
  id: FilterId;
  label: string;
  icon: string;
  count: number;
}

interface WeekGroup {
  key: string;
  label: string;
  source: string;
  done: number;
  goal: number | null;
  prCount: number;
  volumeKg: number;
  items: SessionSummaryDto[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    PageContainerComponent,
    PageHeaderComponent,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    StartSessionDialogComponent,
    CompletionRingComponent,
    SessionDetailDialogComponent,
    RouterLink,
    IconField,
    InputIcon,
    InputTextModule,
    DatePicker
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

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  private readonly searchTerm = signal('');
  readonly fromControl = new FormControl<Date | null>(null);
  readonly toControl = new FormControl<Date | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly starting = signal(false);
  readonly startDialogOpen = signal(false);
  readonly abandonTarget = signal<SessionSummaryDto | null>(null);
  readonly dateRangeOpen = signal(false);

  readonly activeFilter = signal<FilterId>('all');
  /** Per-week open/closed overrides; absent → defaults (first 3 open). */
  private readonly weekOverrides = signal<Record<string, boolean>>({});

  readonly selectedSession = signal<SessionDetailDto | null>(null);
  readonly detailLoading = signal(false);
  private readonly detailOpen = signal(false);

  readonly sessions = this.sessionService.sessions;
  readonly loading = this.sessionService.loading;
  readonly totalCount = this.sessionService.totalCount;
  readonly activeSession = this.sessionService.activeSession;

  readonly isOwner = computed(() => this.tenantService.currentRole() === 'Owner');
  readonly role = computed<'coach' | 'gymbro'>(() => (this.isOwner() ? 'coach' : 'gymbro'));

  readonly headerSubtitle = computed(() => {
    const total = this.totalCount();
    return total > 0 ? `${total} sessions · program + ad-hoc · all time` : 'Track and review your training sessions';
  });

  constructor() {
    this.searchControl.valueChanges.subscribe((v) => this.searchTerm.set(v ?? ''));
  }

  // ── Active-session banner ────────────────────────────────────────────────
  readonly heroSession = computed(() => {
    const active = this.activeSession();
    if (active) {
      const stats = this.activeStats();
      const row = this.sessions().find((s) => s.id === active.sessionId);
      return {
        id: active.sessionId,
        title: this.activeWorkoutTitle(active),
        program: row?.programName ?? (this.isAdhoc(active.source) ? null : 'Assigned plan'),
        day: row?.workoutName ?? null,
        startedAt: active.startedAt,
        durationSeconds: Math.max(0, Math.floor((Date.now() - Date.parse(active.startedAt)) / 1000)),
        completedSets: stats.completedSets,
        totalSets: stats.totalSets,
        canResume: true
      };
    }

    const inProgressRow = this.sessions().find((s) => this.normalizeStatus(s.status) === 'InProgress');
    if (!inProgressRow) return null;
    const startedMs = Date.parse(inProgressRow.startedAt);
    const durationSeconds = !Number.isNaN(startedMs)
      ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
      : inProgressRow.durationSeconds ?? 0;
    return {
      id: inProgressRow.id,
      title: inProgressRow.workoutName ?? 'Workout in progress',
      program: inProgressRow.programName ?? inProgressRow.traineeName ?? null,
      day: inProgressRow.workoutName ?? null,
      startedAt: inProgressRow.startedAt,
      durationSeconds,
      completedSets: 0,
      totalSets: inProgressRow.totalSets ?? 0,
      canResume: !this.isOwner()
    };
  });

  readonly heroProgressPercent = computed(() => {
    const h = this.heroSession();
    if (!h || !h.totalSets) return 0;
    return Math.min(100, Math.round((h.completedSets / h.totalSets) * 100));
  });

  readonly activeStats = computed(() => {
    const a = this.activeSession();
    if (!a) return { completedSets: 0, totalSets: 0 };
    const completedSets =
      a.exercises?.reduce((sum, e) => sum + e.sets.filter((s) => s.isCompleted).length, 0) ?? 0;
    const snapExercises = a.snapshot?.exercises ?? [];
    const totalSets =
      a.exercises?.reduce((sum, e) => {
        const snap = snapExercises.find((s) => s.exerciseId === e.exerciseId);
        return sum + Math.max(snap?.sets?.length ?? 0, e.sets.length);
      }, 0) ?? 0;
    return { completedSets, totalSets };
  });

  // ── List / filtering / grouping ─────────────────────────────────────────
  private readonly nonHeroSessions = computed(() => {
    const heroId = this.heroSession()?.id;
    return this.sessions().filter((s) => s.id !== heroId);
  });

  private readonly searchFiltered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.nonHeroSessions();
    return this.nonHeroSessions().filter((s) =>
      [s.workoutName, s.traineeName, s.programName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term))
    );
  });

  readonly filterChips = computed<FilterChip[]>(() => {
    const list = this.searchFiltered();
    return [
      { id: 'all', label: 'All', icon: 'pi pi-bars', count: list.length },
      {
        id: 'programs',
        label: 'Programs',
        icon: 'pi pi-folder',
        count: list.filter((s) => !this.isAdhoc(s.source)).length
      },
      {
        id: 'adhoc',
        label: 'Ad-hoc',
        icon: 'pi pi-bolt',
        count: list.filter((s) => this.isAdhoc(s.source)).length
      },
      {
        id: 'pr',
        label: 'PRs',
        icon: 'pi pi-trophy',
        count: list.filter((s) => s.prCount > 0).length
      }
    ];
  });

  private readonly filteredSessions = computed(() => {
    const list = this.searchFiltered();
    switch (this.activeFilter()) {
      case 'programs':
        return list.filter((s) => !this.isAdhoc(s.source));
      case 'adhoc':
        return list.filter((s) => this.isAdhoc(s.source));
      case 'pr':
        return list.filter((s) => s.prCount > 0);
      default:
        return list;
    }
  });

  readonly weekGroups = computed<WeekGroup[]>(() => {
    const groups = new Map<string, WeekGroup>();
    const thisWeekKey = this.weekStartKey(new Date());

    for (const s of this.filteredSessions()) {
      const started = new Date(s.startedAt);
      if (Number.isNaN(started.getTime())) continue;
      const key = this.weekStartKey(started);
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: this.weekLabel(key, thisWeekKey),
          source: '',
          done: 0,
          goal: null,
          prCount: 0,
          volumeKg: 0,
          items: []
        };
        groups.set(key, group);
      }
      group.items.push(s);
      if (this.normalizeStatus(s.status) === 'Completed') group.done += 1;
      group.prCount += s.prCount;
      group.volumeKg += s.totalVolumeKg;
      if (s.weeklyGoal != null) group.goal = Math.max(group.goal ?? 0, s.weeklyGoal);
    }

    const result = [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
    for (const g of result) {
      g.items.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
      const srcs = new Set(g.items.map((s) => (this.isAdhoc(s.source) ? 'Ad-hoc' : s.programName ?? 'Plan')));
      g.source = srcs.size > 1 ? `${srcs.size} sources` : [...srcs][0] ?? '';
    }
    return result;
  });

  isWeekOpen(group: WeekGroup, index: number): boolean {
    const override = this.weekOverrides()[group.key];
    return override ?? index < 3;
  }

  toggleWeek(group: WeekGroup, index: number): void {
    const current = this.isWeekOpen(group, index);
    this.weekOverrides.update((o) => ({ ...o, [group.key]: !current }));
  }

  // ── Rail: This week / Program / Jump-to-week ─────────────────────────────
  readonly thisWeek = computed(() => {
    const weekKey = this.weekStartKey(new Date());
    const inWeek = this.sessions().filter((s) => this.weekStartKey(new Date(s.startedAt)) === weekKey);
    const done = inWeek.filter((s) => this.normalizeStatus(s.status) === 'Completed').length;
    const goalRow = inWeek.find((s) => s.weeklyGoal != null) ?? this.sessions().find((s) => s.weeklyGoal != null);
    return {
      done,
      goal: goalRow?.weeklyGoal ?? null,
      volumeKg: Math.round(inWeek.reduce((sum, s) => sum + s.totalVolumeKg, 0)),
      sets: inWeek.reduce((sum, s) => sum + s.totalSets, 0)
    };
  });

  readonly program = computed(() => {
    const row = this.sessions().find((s) => !this.isAdhoc(s.source) && s.programName);
    if (!row) return null;
    return { name: row.programName!, week: row.planWeek, goal: row.weeklyGoal };
  });

  // ── Lifecycle / data ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.refresh();
    this.sessionService.getActive().subscribe();
  }

  refresh(): void {
    const params = {
      from: this.toIsoDate(this.fromControl.value),
      to: this.toIsoDate(this.toControl.value),
      page: this.page(),
      pageSize: this.pageSize()
    };
    // Coach (Owner) sees their gym's member activity (tenant-scoped); a trainee sees their own unified
    // history across every gym (/api/me). Ownership is a capability layered on the personal experience.
    const source$ = this.isOwner()
      ? this.sessionService.list(params)
      : this.sessionService.listMine(params);
    source$.subscribe({
      error: () =>
        this.messageService.add({
          severity: 'error',
          summary: 'Could not load sessions',
          detail: 'Please try again in a moment.'
        })
    });
  }

  applyDateFilter(): void {
    this.page.set(1);
    this.refresh();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.fromControl.setValue(null);
    this.toControl.setValue(null);
    this.activeFilter.set('all');
    this.applyDateFilter();
  }

  private toIsoDate(d: Date | null | undefined): string | undefined {
    if (!d) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  startWorkout(): void {
    const active = this.activeSession();
    if (active && this.normalizeStatus(active.status) === 'InProgress') {
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
        this.sessionService.getActive().subscribe({
          next: () => void this.router.navigate(['/workspace/logs/session', res.sessionId]),
          error: () => void this.router.navigate(['/workspace/logs/session', res.sessionId])
        });
      },
      error: (err) => {
        this.starting.set(false);
        const detail =
          err?.status === 409 ? 'You already have a session in progress.' : 'Could not start session.';
        this.messageService.add({ severity: 'error', summary: 'Cannot start workout', detail });
      }
    });
  }

  resumeHero(sessionId: string): void {
    void this.router.navigate(['/workspace/logs/session', sessionId]);
  }

  /** Row tap: in-progress opens the live session; everything else opens the detail modal. */
  openSession(session: SessionSummaryDto): void {
    if (this.normalizeStatus(session.status) === 'InProgress') {
      void this.router.navigate(['/workspace/logs/session', session.id]);
      return;
    }
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.selectedSession.set(null);
    // Match the list source: coach reads a member's session tenant-scoped; trainee reads their own
    // session self-scoped (works across gyms).
    const detail$ = this.isOwner()
      ? this.sessionService.getById(session.id)
      : this.sessionService.getMineById(session.id);
    detail$.subscribe({
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

  readonly isDetailOpen = computed(() => this.detailOpen());

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedSession.set(null);
  }

  onRepeatWorkout(): void {
    this.closeDetail();
    this.startWorkout();
  }

  requestAbandon(session: SessionSummaryDto): void {
    this.abandonTarget.set(session);
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
        this.messageService.add({ severity: 'error', summary: 'Could not abandon session' });
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

  // ── Presentation helpers ─────────────────────────────────────────────────
  dayBadge(session: SessionSummaryDto): { abbr: string; cls: string } {
    if (this.normalizeStatus(session.status) === 'Abandoned') return { abbr: '—', cls: 'abandoned' };
    if (this.isAdhoc(session.source)) return { abbr: 'ADH', cls: 'adhoc' };
    const name = (session.workoutName ?? '').toLowerCase();
    if (name.includes('push')) return { abbr: 'PSH', cls: 'push' };
    if (name.includes('pull')) return { abbr: 'PUL', cls: 'pull' };
    if (name.includes('leg')) return { abbr: 'LEG', cls: 'legs' };
    if (name.includes('arm')) return { abbr: 'ARM', cls: 'arms' };
    if (name.includes('mobil') || name.includes('check')) return { abbr: 'MOB', cls: 'mobility' };
    return { abbr: (session.workoutName ?? 'SES').slice(0, 3).toUpperCase(), cls: 'plan' };
  }

  /** Template-facing source/status helpers (API enums are camelCase). */
  isAdhocSession(session: SessionSummaryDto): boolean {
    return this.isAdhoc(session.source);
  }

  isAbandoned(session: SessionSummaryDto): boolean {
    return this.normalizeStatus(session.status) === 'Abandoned';
  }

  sourceTag(session: SessionSummaryDto): string {
    if (this.isAdhoc(session.source)) return 'Ad-hoc';
    const program = session.programName?.trim();
    const day = session.workoutName?.trim();
    if (program && day) return `${program} · ${day}`;
    return program ?? day ?? 'Plan';
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    const mins = Math.round(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
  }

  formatVolume(kg: number): string {
    if (!kg) return '0';
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
    return Math.round(kg).toString();
  }

  relativeDay(value: string | null): string {
    if (!value) return '';
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

  startedTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  activeWorkoutTitle(active: ActiveSessionDto | null): string {
    if (!active) return '';
    return active.workoutNameSnapshot || active.snapshot?.workoutName || 'Workout in progress';
  }

  private weekStartKey(date: Date): string {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private weekLabel(key: string, thisWeekKey: string): string {
    const start = new Date(`${key}T00:00:00`);
    const thisStart = new Date(`${thisWeekKey}T00:00:00`);
    const weeksAgo = Math.round((thisStart.getTime() - start.getTime()) / (7 * MS_PER_DAY));
    if (weeksAgo <= 0) return 'This week';
    if (weeksAgo === 1) return 'Last week';
    return `Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  /** API serializes enums as camelCase (`adhoc`, `fromAssignment`), so compare case-insensitively. */
  private isAdhoc(source: string | null | undefined): boolean {
    return String(source ?? '').toLowerCase() === 'adhoc';
  }

  /** API serializes SessionStatus as camelCase (`inProgress`/`completed`/`abandoned`). */
  private normalizeStatus(status: SessionStatus | string | null | undefined): SessionStatus {
    const s = String(status ?? '').toLowerCase();
    if (s === 'inprogress') return 'InProgress';
    if (s === 'abandoned') return 'Abandoned';
    return 'Completed';
  }
}
