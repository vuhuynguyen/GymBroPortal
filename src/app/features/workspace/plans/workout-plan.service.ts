import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  CreateWorkoutPlanRequest,
  MyAssignedPlanDto,
  MyPlanDto,
  ReplaceWorkoutPlanStructureRequest,
  UpdateWorkoutPlanRequest,
  WorkoutPlanDetailDto,
  WorkoutPlanListResponseDto
} from './workout-plan.model';

@Injectable({ providedIn: 'root' })
export class WorkoutPlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/workout-plans';

  list(params?: { search?: string; page?: number; pageSize?: number }): Observable<WorkoutPlanListResponseDto> {
    let query = new HttpParams();
    if (params?.search?.trim()) query = query.set('search', params.search.trim());
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return this.http.get<WorkoutPlanListResponseDto>(this.baseUrl, { params: query });
  }

  listMyAssignments(): Observable<MyAssignedPlanDto[]> {
    return this.http
      .get<{
        items?: Array<{
          id: string;
          planId: string;
          frequencyDaysPerWeek?: number;
          visibilityMode?: MyAssignedPlanDto['visibilityMode'] | number;
        }>;
      }>(`${this.baseUrl}/assignments`, { params: new HttpParams().set('pageSize', '200') })
      .pipe(
        map((response) =>
          (response.items ?? []).map((item) => ({
            id: item.id,
            planId: item.planId,
            daysPerWeek: item.frequencyDaysPerWeek ?? null,
            visibilityMode: this.normalizeVisibilityMode(item.visibilityMode)
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

  create(body: CreateWorkoutPlanRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, body);
  }

  update(id: string, body: UpdateWorkoutPlanRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, body);
  }

  replaceStructure(id: string, body: ReplaceWorkoutPlanStructureRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/structure`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  private normalizeVisibilityMode(value: unknown): NonNullable<MyAssignedPlanDto['visibilityMode']> | null {
    if (value === 'Full' || value === 1) return 'Full';
    if (value === 'Guided' || value === 2) return 'Guided';
    if (value === 'Blind' || value === 3) return 'Blind';
    return null;
  }
}
