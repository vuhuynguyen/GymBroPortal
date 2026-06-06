import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
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
  private readonly baseUrl = '/api/sessions';

  readonly sessions = signal<SessionSummaryDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly activeSession = signal<ActiveSessionDto | null>(null);

  list(params?: ListSessionsParams): Observable<SessionListResponseDto> {
    let query = new HttpParams();
    if (params?.traineeId?.trim()) query = query.set('traineeId', params.traineeId.trim());
    if (params?.from) query = query.set('from', params.from);
    if (params?.to) query = query.set('to', params.to);
    if (params?.status) query = query.set('status', params.status);
    if (params?.planAssignmentId) query = query.set('planAssignmentId', params.planAssignmentId);
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));

    this.loading.set(true);
    return this.http.get<SessionListResponseDto>(this.baseUrl, { params: query }).pipe(
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

  getById(sessionId: string): Observable<SessionDetailDto> {
    return this.http.get<SessionDetailDto>(`${this.baseUrl}/${sessionId}`);
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
