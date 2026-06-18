/** API DTOs for the coach adherence reads `/api/nutrition/logs` (camelCase JSON). */

export type DailyLogStatusApi = 'open' | 'closed' | string;

export interface DailyNutritionLogSummaryDto {
  id: string;
  traineeId: string;
  /** ISO date (yyyy-MM-dd). */
  localDate: string;
  status: DailyLogStatusApi;
  source: string;
  adherencePct: number;
  plannedCount: number;
  completedCount: number;
}

export interface DailyNutritionLogListResponseDto {
  items: DailyNutritionLogSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface LoggedItemDto {
  id: string;
  planMealItemId: string | null;
  isPlanned: boolean;
  foodId: string | null;
  kind: string;
  foodName: string;
  servingLabel: string;
  quantity: number;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  /** camelCase `LoggedItemStatus` string — normalize via `loggedItemStatusToLabel`. */
  status: string;
  loggedAtUtc: string | null;
  note: string | null;
}

export interface LoggedMealDto {
  name: string;
  /** TimeOnly on the wire ("HH:mm:ss") or null. */
  scheduledTime: string | null;
  items: LoggedItemDto[];
}

export interface DailyNutritionLogDetailDto {
  id: string | null;
  traineeId: string;
  localDate: string;
  status: DailyLogStatusApi;
  source: string;
  hasPlan: boolean;
  adherencePct: number;
  plannedCount: number;
  completedCount: number;
  meals: LoggedMealDto[];
  /**
   * When the active assignment disables trainee self-editing the self-log surface must hide its logging
   * affordances. Optional because the self-scoped day read does not currently carry it (it lives on the
   * coach assignment DTO) — honored defensively if/when the API adds it to the day read.
   */
  disableTraineeEditing?: boolean;
}

/**
 * The full day log returned by `GET /api/me/nutrition/today|days/{date}` — identical wire shape to the
 * coach `DailyNutritionLogDetailDto` (the C# `DailyNutritionLogDto`). Aliased rather than duplicated so
 * the self-log surface and the coach adherence view share one model.
 */
export type DailyNutritionLogDto = DailyNutritionLogDetailDto;

/** One check-in metric entry — `GET /api/me/nutrition/metrics` items, newest-first. */
export interface MetricEntryDto {
  /** camelCase metric type ("weight", "sleep", …). */
  type: string;
  value: number;
  unit: string | null;
  /** ISO date (yyyy-MM-dd). */
  localDate: string;
  loggedAtUtc: string;
}

export interface MetricEntryListDto {
  items: MetricEntryDto[];
}

/** Body check-in metric write — `POST /api/me/nutrition/metrics`. */
export interface LogMetricRequest {
  type: 'weight' | 'sleep';
  value: number;
  unit?: string;
  localDate?: string;
}

/** Item status write — `POST /api/nutrition/log/items/status` (tenant-scoped). */
export interface SetItemStatusRequest {
  date: string;
  itemId: string;
  /** Only `completed` | `skipped` are caller-settable; `missed` is server-only. */
  status: 'completed' | 'skipped';
  note?: string;
}

/** Substitute write — `POST /api/nutrition/log/items/substitute` (tenant-scoped). */
export interface SubstituteItemRequest {
  date: string;
  itemId: string;
  foodId: string;
  quantity?: number;
  note?: string;
}

/**
 * Ad-hoc (off-plan) item write — `POST /api/nutrition/log/items` (tenant-scoped). Either `foodId` (a
 * catalog food) OR the inline custom-food snapshot fields. Returns the new item id (bare Guid string).
 */
export interface AddAdhocItemRequest {
  date: string;
  foodId?: string;
  quantity: number;
  mealName?: string;
  note?: string;
  customName?: string;
  customKind?: string;
  servingLabel?: string;
  energyKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
}
