import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { visibilityModeToLabel } from '../../../shared/plan-visibility';
import type {
  CreateWorkoutPlanRequest,
  MyAssignedPlanDto,
  MyPlanDto,
  ReplaceWorkoutPlanStructureRequest,
  UpdateWorkoutPlanRequest,
  WorkoutPlanDetailDto,
  WorkoutPlanListResponseDto,
  WorkoutPlanVersionRef
} from './workout-plan.model';

@Injectable({ providedIn: 'root' })
export class WorkoutPlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/workout-plans';

  list(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
    archived?: boolean;
  }): Observable<WorkoutPlanListResponseDto> {
    let query = new HttpParams();
    if (params?.search?.trim()) query = query.set('search', params.search.trim());
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    if (params?.archived) query = query.set('archived', 'true');
    return this.http.get<WorkoutPlanListResponseDto>(this.baseUrl, { params: query });
  }

  archive(id: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/archive`, {});
  }

  unarchive(id: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/unarchive`, {});
  }

  listMyAssignments(): Observable<MyAssignedPlanDto[]> {
    return this.http
      .get<{
        items?: Array<{
          id: string;
          planId: string;
          startDate?: string;
          frequencyDaysPerWeek?: number;
          visibilityMode?: MyAssignedPlanDto['visibilityMode'] | number;
          hideExercises?: boolean;
          hideSetsReps?: boolean;
          hideFutureWorkouts?: boolean;
        }>;
      }>(`${this.baseUrl}/assignments`, {
        // Only active assignments belong in the start-workout picker; paused ones stay hidden.
        params: new HttpParams().set('pageSize', '200').set('activeOnly', 'true')
      })
      .pipe(
        map((response) =>
          (response.items ?? []).map((item) => ({
            id: item.id,
            planId: item.planId,
            daysPerWeek: item.frequencyDaysPerWeek ?? null,
            startDate: item.startDate ?? null,
            visibilityMode: this.normalizeVisibilityMode(item.visibilityMode),
            hideExercises: item.hideExercises ?? false,
            hideSetsReps: item.hideSetsReps ?? false,
            hideFutureWorkouts: item.hideFutureWorkouts ?? false
          }))
        )
      );
  }

  listMyPlans(): Observable<MyPlanDto[]> {
    return this.http
      .get<WorkoutPlanListResponseDto>(this.baseUrl, { params: new HttpParams().set('pageSize', '200') })
      .pipe(
        map((response) =>
          (response.items ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            daysPerWeek: item.workoutsPerWeek ?? null
          }))
        )
      );
  }

  get(id: string): Observable<WorkoutPlanDetailDto> {
    return this.http.get<WorkoutPlanDetailDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Resolve the latest version in the template that `id` belongs to. The plan builder loads through this so a
   * stale (non-latest) version id self-heals to the editable latest version instead of 409-ing at save time.
   */
  getLatest(id: string): Observable<WorkoutPlanDetailDto> {
    return this.http.get<WorkoutPlanDetailDto>(`${this.baseUrl}/${id}/latest`);
  }

  create(body: CreateWorkoutPlanRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, body);
  }

  // Editing forks a new immutable version; the server returns its id so the caller re-points to the latest.
  update(id: string, body: UpdateWorkoutPlanRequest): Observable<WorkoutPlanVersionRef> {
    return this.http.put<WorkoutPlanVersionRef>(`${this.baseUrl}/${id}`, body);
  }

  replaceStructure(id: string, body: ReplaceWorkoutPlanStructureRequest): Observable<WorkoutPlanVersionRef> {
    return this.http.put<WorkoutPlanVersionRef>(`${this.baseUrl}/${id}/structure`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  private normalizeVisibilityMode(value: unknown): NonNullable<MyAssignedPlanDto['visibilityMode']> | null {
    return visibilityModeToLabel(value);
  }
}
