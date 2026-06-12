import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TenantService } from '../../../core/tenant/tenant';
import type { FoodDto } from '../nutrition-plans/food.model';
import type {
  AddAdhocItemRequest,
  DailyNutritionLogDto,
  DailyNutritionLogListResponseDto,
  LogMetricRequest,
  MetricEntryDto,
  MetricEntryListDto,
  SetItemStatusRequest,
  SubstituteItemRequest
} from '../client-nutrition/nutrition-log.model';
import {
  applyAddAdhoc,
  applyRemove,
  applyStatus,
  applySubstitute,
  buildAdhocItem,
  OFF_PLAN_MEAL
} from './my-nutrition-today';

/** Latest weight + sleep readings, derived newest-first from the metrics series. */
export interface DailyCheckin {
  weightKg: number | null;
  sleepHours: number | null;
}

/**
 * Self-logging nutrition state for the "My Nutrition" surface — the web mirror of the Flutter
 * `TodayNutritionController` + `CheckinController`. Reads are self-scoped & cross-gym
 * (`/api/me/nutrition/*`, the active tenant header is harmless/ignored); item writes are tenant-scoped
 * (`/api/nutrition/log/*`, `X-Tenant-Id` from the active gym is attached by `authInterceptor`). Item
 * writes apply optimistically and roll back on a real error; an off-plan add reconciles with a silent
 * refetch so the local row picks up its real server id + roll-up counts.
 */
@Injectable({ providedIn: 'root' })
export class MyNutritionService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantService);

  private readonly meBase = '/api/me/nutrition';
  private readonly logBase = '/api/nutrition/log';

  // ── Today ──────────────────────────────────────────────────────────────
  readonly today = signal<DailyNutritionLogDto | null>(null);
  readonly todayLoading = signal(false);
  readonly todayError = signal<string | null>(null);

  // ── History ────────────────────────────────────────────────────────────
  readonly historyDays = signal<DailyNutritionLogListResponseDto['items']>([]);
  readonly historyLoading = signal(false);

  // ── Check-in ─────────────────────────────────────────────────────────────
  readonly checkin = signal<DailyCheckin>({ weightKg: null, sleepHours: null });
  readonly checkinLoading = signal(false);

  /** The day key all writes scope to (the loaded Today log's date). */
  private readonly todayDate = computed(() => this.today()?.localDate ?? null);

  /** True only when the user has no active gym — item writes (tenant-scoped) can't be persisted. */
  private tenantGuardError(): string | null {
    return this.tenant.activeTenantId() ? null : 'Select a gym to log this item.';
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** Load today's log (`GET /api/me/nutrition/today`, lazily created server-side). */
  loadToday(date?: string): void {
    this.todayLoading.set(true);
    this.todayError.set(null);
    let params = new HttpParams().set('timezone', browserTimezone());
    if (date) params = params.set('date', date);
    this.http.get<DailyNutritionLogDto>(`${this.meBase}/today`, { params }).subscribe({
      next: (log) => {
        this.today.set(log);
        this.todayLoading.set(false);
      },
      error: () => {
        this.todayLoading.set(false);
        this.todayError.set('Could not load today’s nutrition.');
      }
    });
  }

  /** Load the self history timeline (`GET /api/me/nutrition/days`). */
  loadHistory(params?: { from?: string; to?: string; page?: number; pageSize?: number }): void {
    this.historyLoading.set(true);
    let query = new HttpParams();
    if (params?.from) query = query.set('from', params.from);
    if (params?.to) query = query.set('to', params.to);
    if (params?.page) query = query.set('page', String(params.page));
    query = query.set('pageSize', String(params?.pageSize ?? 30));
    this.http
      .get<DailyNutritionLogListResponseDto>(`${this.meBase}/days`, { params: query })
      .subscribe({
        next: (res) => {
          this.historyDays.set(res.items ?? []);
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyDays.set([]);
          this.historyLoading.set(false);
        }
      });
  }

  /** One past day's read-only detail (`GET /api/me/nutrition/days/{date}`). */
  getDay(date: string): Promise<DailyNutritionLogDto> {
    return firstValueFrom(this.http.get<DailyNutritionLogDto>(`${this.meBase}/days/${date}`));
  }

  /** Load the latest check-in (weight + sleep) — newest-first metrics, first entry per type wins. */
  loadCheckin(date?: string): void {
    this.checkinLoading.set(true);
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    this.http.get<MetricEntryListDto>(`${this.meBase}/metrics`, { params }).subscribe({
      next: (res) => {
        this.checkin.set(latestCheckin(res.items ?? []));
        this.checkinLoading.set(false);
      },
      error: () => {
        this.checkin.set({ weightKg: null, sleepHours: null });
        this.checkinLoading.set(false);
      }
    });
  }

  // ── Optimistic item writes (tenant-scoped) ────────────────────────────────

  /** Set a planned item Completed/Skipped (or un-complete a planned item back to planned). */
  async setStatus(itemId: string, status: 'completed' | 'skipped' | 'planned'): Promise<void> {
    const date = this.todayDate();
    const current = this.today();
    if (!date || !current) return;
    const guard = this.tenantGuardError();
    if (guard) throw new Error(guard);

    this.today.set(applyStatus(current, itemId, status));
    // The API only accepts completed|skipped; un-completing a planned item is "skipped" on the wire,
    // but to mirror the mobile loop we treat "planned" as a local un-mark and send "skipped".
    const wire: SetItemStatusRequest['status'] = status === 'completed' ? 'completed' : 'skipped';
    try {
      await this.post<SetItemStatusRequest, unknown>(`${this.logBase}/items/status`, {
        date,
        itemId,
        status: wire
      });
    } catch (err) {
      this.today.set(current);
      throw err;
    }
  }

  /** Swap a planned item for a different catalog food. */
  async substitute(itemId: string, food: FoodDto, quantity: number): Promise<void> {
    const date = this.todayDate();
    const current = this.today();
    if (!date || !current) return;
    const guard = this.tenantGuardError();
    if (guard) throw new Error(guard);

    this.today.set(applySubstitute(current, itemId, food, quantity));
    try {
      await this.post<SubstituteItemRequest, unknown>(`${this.logBase}/items/substitute`, {
        date,
        itemId,
        foodId: food.id,
        quantity
      });
    } catch (err) {
      this.today.set(current);
      throw err;
    }
  }

  /** Log an off-plan food into [mealName] (or the synthetic Off-plan bucket); reconciles on success. */
  async addOffPlan(food: FoodDto, quantity: number, mealName?: string): Promise<void> {
    const date = this.todayDate();
    const current = this.today();
    if (!date || !current) return;
    const guard = this.tenantGuardError();
    if (guard) throw new Error(guard);

    const target = mealName ?? OFF_PLAN_MEAL;
    const localId = `local-${Date.now()}`;
    this.today.set(applyAddAdhoc(current, buildAdhocItem(food, quantity, localId), target));

    const body: AddAdhocItemRequest = food.isCustom
      ? {
          date,
          quantity,
          mealName: target,
          customName: food.name,
          customKind: food.kind,
          servingLabel: food.servingLabel,
          energyKcal: food.energyKcal ?? undefined,
          proteinG: food.proteinG ?? undefined,
          carbsG: food.carbsG ?? undefined,
          fatG: food.fatG ?? undefined,
          fiberG: food.fiberG ?? undefined
        }
      : { date, foodId: food.id, quantity, mealName: target };

    try {
      await this.post<AddAdhocItemRequest, string>(`${this.logBase}/items`, body);
    } catch (err) {
      this.today.set(current);
      throw err;
    }
    // Reconcile: replace the local optimistic row with the server-persisted item (real id + counts).
    await this.reloadTodaySilently();
  }

  /** Remove an ad-hoc item (planned items can't be removed — skip them). */
  async removeItem(itemId: string): Promise<void> {
    const date = this.todayDate();
    const current = this.today();
    if (!date || !current) return;
    const guard = this.tenantGuardError();
    if (guard) throw new Error(guard);

    this.today.set(applyRemove(current, itemId));
    try {
      await firstValueFrom(
        this.http.delete(`${this.logBase}/items/${itemId}`, {
          params: new HttpParams().set('date', date)
        })
      );
    } catch (err) {
      this.today.set(current);
      throw err;
    }
  }

  // ── Check-in write (self-scoped) ──────────────────────────────────────────

  /** Log a weight (kg) — optimistic, rolls back on error. */
  logWeight(kg: number): Promise<void> {
    return this.logMetric({ type: 'weight', value: kg, unit: 'kg' }, (c) => ({ ...c, weightKg: kg }));
  }

  /** Log sleep (hours) — optimistic, rolls back on error. */
  logSleep(hours: number): Promise<void> {
    return this.logMetric({ type: 'sleep', value: hours, unit: 'h' }, (c) => ({ ...c, sleepHours: hours }));
  }

  private async logMetric(
    body: LogMetricRequest,
    optimistic: (c: DailyCheckin) => DailyCheckin
  ): Promise<void> {
    const current = this.checkin();
    this.checkin.set(optimistic(current));
    try {
      await this.post<LogMetricRequest, { logged: boolean }>(`${this.meBase}/metrics`, body);
    } catch (err) {
      this.checkin.set(current);
      throw err;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async reloadTodaySilently(): Promise<void> {
    try {
      const fresh = await firstValueFrom(
        this.http.get<DailyNutritionLogDto>(`${this.meBase}/today`, {
          params: new HttpParams().set('timezone', browserTimezone())
        })
      );
      this.today.set(fresh);
    } catch {
      // Best-effort: a refetch failure keeps the optimistic state rather than surfacing an error for a
      // write that already succeeded.
    }
  }

  private post<TBody, TRes>(url: string, body: TBody): Promise<TRes> {
    return firstValueFrom(this.http.post<TRes>(url, body));
  }
}

/** Latest reading per type (the series is newest-first, so the first match wins). */
export function latestCheckin(items: MetricEntryDto[]): DailyCheckin {
  const first = (type: string): number | null => {
    const hit = items.find((m) => String(m.type ?? '').toLowerCase() === type);
    return hit ? hit.value : null;
  };
  return { weightKg: first('weight'), sleepHours: first('sleep') };
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
