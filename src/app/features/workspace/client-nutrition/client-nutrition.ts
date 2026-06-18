import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonComponent, PageContainerComponent, PageHeaderComponent } from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { WorkspaceService } from '../workspace';
import { NutritionLogService } from './nutrition-log.service';
import type { DailyNutritionLogDetailDto, DailyNutritionLogSummaryDto } from './nutrition-log.model';
import {
  adherenceTone,
  clampAdherencePct,
  completionLine,
  relativeDayLabel,
  type AdherenceTone
} from './nutrition-adherence';
import { NutritionDayDetailDialogComponent } from './nutrition-day-detail-dialog/nutrition-day-detail-dialog';

/**
 * Coach view of one client's nutrition adherence — day rows with an adherence badge, drill-in via the
 * nutrition-day-detail dialog. Clone of `client-workouts` against `GET /api/nutrition/logs?traineeId=…`
 * (tenant-scoped, NutritionLogViewAll-gated on the API). Read-only.
 */
@Component({
  selector: 'app-client-nutrition',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    ButtonComponent,
    NutritionDayDetailDialogComponent
  ],
  templateUrl: './client-nutrition.html',
  styleUrl: './client-nutrition.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientNutritionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly nutritionLogService = inject(NutritionLogService);
  private readonly tenantService = inject(TenantService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly messageService = inject(MessageService);

  private readonly clientId = signal<string>('');
  readonly days = signal<DailyNutritionLogSummaryDto[]>([]);
  readonly loading = signal(false);

  readonly selectedDay = signal<DailyNutritionLogDetailDto | null>(null);
  readonly detailLoading = signal(false);
  readonly detailOpen = signal(false);

  readonly clientName = computed(() => {
    const id = this.clientId();
    return this.workspaceService.members().find((m) => m.userId === id)?.name ?? 'Client';
  });

  readonly subtitle = computed(() => {
    const n = this.days().length;
    return n > 0 ? `${n} logged day${n === 1 ? '' : 's'}` : 'No nutrition days yet';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('clientId') ?? '';
    this.clientId.set(id);

    // The client's logs live in the coach's own gym → ensure that tenant is the active context.
    this.tenantService.selectOwnWorkspace();
    const ownId = this.tenantService.ownTenant()?.id;
    if (ownId) this.workspaceService.loadMembers(ownId);

    if (id) this.load(id);
  }

  private load(clientId: string): void {
    this.loading.set(true);
    this.nutritionLogService.listForClient(clientId, { pageSize: 60 }).subscribe({
      next: (res) => {
        this.days.set(res.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load nutrition days' });
      }
    });
  }

  back(): void {
    void this.router.navigate(['/workspace/clients']);
  }

  openDay(day: DailyNutritionLogSummaryDto): void {
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.selectedDay.set(null);
    this.nutritionLogService.getDay(this.clientId(), day.localDate).subscribe({
      next: (detail) => {
        this.selectedDay.set(detail);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailOpen.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load day details' });
      }
    });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedDay.set(null);
  }

  // ── Presentation helpers ─────────────────────────────────────────────────
  dayLabel(day: DailyNutritionLogSummaryDto): string {
    return relativeDayLabel(day.localDate);
  }

  adherenceLabel(day: DailyNutritionLogSummaryDto): string {
    return day.plannedCount > 0 ? `${clampAdherencePct(day.adherencePct)}%` : 'No plan';
  }

  tone(day: DailyNutritionLogSummaryDto): AdherenceTone {
    return adherenceTone(clampAdherencePct(day.adherencePct), day.plannedCount);
  }

  completion(day: DailyNutritionLogSummaryDto): string {
    return completionLine(day.completedCount, day.plannedCount);
  }

  statusLabel(day: DailyNutritionLogSummaryDto): string {
    return String(day.status ?? '').toLowerCase() === 'closed' ? 'Closed' : 'Open';
  }

  trackByDate(_index: number, item: DailyNutritionLogSummaryDto): string {
    return item.localDate;
  }
}
