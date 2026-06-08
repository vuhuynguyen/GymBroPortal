import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TenantService } from '../../../core/tenant/tenant';
import { catchError, map, tap } from 'rxjs/operators';
import type {
  ActiveSessionDto,
  AddExerciseRequest,
  CompleteSessionRequest,
  ListSessionsParams,
  LogSetRequest,
  PerformedExerciseDto,
  PerformedSetDto,
  SessionDetailDto,
  SessionListResponseDto,
  SessionSummaryDto,
  StartSessionRequest,
  StartSessionResponse
} from './session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);
  private readonly baseUrl = '/api/sessions';
  // Unified personal training experience: the caller's own sessions across every gym they belong to.
  // No X-Tenant-Id dependency (the interceptor still sends it; the API ignores it for these routes).
  private readonly mineUrl = '/api/me/sessions';

  readonly sessions = signal<SessionSummaryDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly activeSession = signal<ActiveSessionDto | null>(null);

  constructor() {
    // Clear tenant-scoped session state when the active workspace changes, so switching workspaces
    // never momentarily shows the previous tenant's sessions. Skips the initial run (nothing to clear).
    let first = true;
    effect(() => {
      this.tenantService.activeTenantId();
      if (first) {
        first = false;
        return;
      }
      this.reset();
    });
  }

  /** Clear all cached session state. Invoked automatically on a tenant switch. */
  reset(): void {
    this.sessions.set([]);
    this.totalCount.set(0);
    this.loading.set(false);
    this.activeSession.set(null);
  }

  /**
   * Tenant-scoped session list. For an Owner (coach) this is their gym's member activity; for a Client
   * it is their own sessions in the active gym. Used by the coach/owner view.
   */
  list(params?: ListSessionsParams): Observable<SessionListResponseDto> {
    return this.fetchList(this.baseUrl, this.toQuery(params, true));
  }

  /**
   * Unified personal history: the caller's own sessions across ALL gyms, via `GET /api/me/sessions`.
   * Used by the trainee/personal view; never includes anyone else's sessions.
   */
  listMine(params?: ListSessionsParams): Observable<SessionListResponseDto> {
    return this.fetchList(this.mineUrl, this.toQuery(params, false));
  }

  private toQuery(params: ListSessionsParams | undefined, includeTenantScoped: boolean): HttpParams {
    let query = new HttpParams();
    // traineeId / planAssignmentId are coach-only filters on the tenant-scoped endpoint; the personal
    // (`/api/me`) endpoint is always self-scoped and ignores them.
    if (includeTenantScoped && params?.traineeId?.trim()) query = query.set('traineeId', params.traineeId.trim());
    if (params?.from) query = query.set('from', params.from);
    if (params?.to) query = query.set('to', params.to);
    if (params?.status) query = query.set('status', params.status);
    if (includeTenantScoped && params?.planAssignmentId) query = query.set('planAssignmentId', params.planAssignmentId);
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return query;
  }

  private fetchList(url: string, params: HttpParams): Observable<SessionListResponseDto> {
    this.loading.set(true);
    return this.http.get<SessionListResponseDto>(url, { params }).pipe(
      tap((response) => {
        this.sessions.set(response.items ?? []);
        this.totalCount.set(response.totalCount ?? 0);
        this.loading.set(false);
      }),
      catchError((err) => {
        this.loading.set(false);
        throw err;
      })
    );
  }

  /**
   * Coach-only: one client's sessions in the active gym (tenant-scoped; needs `WorkoutLogViewAll`).
   * Returns the response directly without mutating the shared list signals, so a per-client view can
   * hold its own local state independent of the main Logs page.
   */
  listForClient(traineeId: string, page = 1, pageSize = 50): Observable<SessionListResponseDto> {
    const params = new HttpParams()
      .set('traineeId', traineeId)
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    return this.http.get<SessionListResponseDto>(this.baseUrl, { params });
  }

  /** Tenant-scoped detail (coach viewing a gym member's session). */
  getById(sessionId: string): Observable<SessionDetailDto> {
    return this.http.get<SessionDetailDto>(`${this.baseUrl}/${sessionId}`);
  }

  /** Self-scoped detail for the unified personal history; resolves the caller's own session in any gym. */
  getMineById(sessionId: string): Observable<SessionDetailDto> {
    return this.http.get<SessionDetailDto>(`${this.mineUrl}/${sessionId}`);
  }

  /** Returns null when API responds 204 No Content. */
  getActive(): Observable<ActiveSessionDto | null> {
    return this.http
      .get<ActiveSessionDto>(`${this.baseUrl}/active`, { observe: 'response' })
      .pipe(
        map((res) => (res.status === 204 ? null : res.body ?? null)),
        tap((session) => this.activeSession.set(session)),
        catchError(() => of(null))
      );
  }

  start(body: StartSessionRequest): Observable<StartSessionResponse> {
    return this.http.post<StartSessionResponse>(this.baseUrl, body).pipe(
      tap(() => this.activeSession.set(null))
    );
  }

  addExercise(sessionId: string, body: AddExerciseRequest): Observable<PerformedExerciseDto> {
    return this.http.post<PerformedExerciseDto>(`${this.baseUrl}/${sessionId}/exercises`, body);
  }

  logSet(
    sessionId: string,
    exerciseId: string,
    body: LogSetRequest
  ): Observable<PerformedSetDto> {
    return this.http.post<PerformedSetDto>(
      `${this.baseUrl}/${sessionId}/exercises/${exerciseId}/sets`,
      body
    );
  }

  deleteSet(sessionId: string, exerciseId: string, setId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${sessionId}/exercises/${exerciseId}/sets/${setId}`
    );
  }

  complete(sessionId: string, body: CompleteSessionRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${sessionId}/complete`, body).pipe(
      tap(() => {
        if (this.activeSession()?.sessionId === sessionId) {
          this.activeSession.set(null);
        }
      })
    );
  }

  abandon(sessionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${sessionId}/abandon`, {}).pipe(
      tap(() => {
        if (this.activeSession()?.sessionId === sessionId) {
          this.activeSession.set(null);
        }
      })
    );
  }
}
