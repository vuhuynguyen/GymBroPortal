import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CreateNutritionPlanRequest,
  NutritionPlanDetailDto,
  NutritionPlanListResponseDto,
  NutritionPlanVersionRef,
  ReplaceNutritionPlanStructureRequest
} from './nutrition-plan.model';

/** Typed calls against `/api/nutrition/plans` — sibling of WorkoutPlanService. */
@Injectable({ providedIn: 'root' })
export class NutritionPlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/nutrition/plans';

  list(params?: {
    search?: string;
    archived?: boolean;
    page?: number;
    pageSize?: number;
  }): Observable<NutritionPlanListResponseDto> {
    let query = new HttpParams();
    if (params?.search?.trim()) query = query.set('search', params.search.trim());
    if (params?.archived) query = query.set('archived', 'true');
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return this.http.get<NutritionPlanListResponseDto>(this.baseUrl, { params: query });
  }

  get(id: string): Observable<NutritionPlanDetailDto> {
    return this.http.get<NutritionPlanDetailDto>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateNutritionPlanRequest): Observable<string> {
    return this.http.post<string>(this.baseUrl, body);
  }

  /**
   * One save = one new immutable version: metadata + meals go together and the server returns the new
   * version id so the builder re-points to the latest (same versioning UX as the workout builder).
   */
  replaceStructure(
    id: string,
    body: ReplaceNutritionPlanStructureRequest
  ): Observable<NutritionPlanVersionRef> {
    return this.http.put<NutritionPlanVersionRef>(`${this.baseUrl}/${id}/structure`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  archive(id: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/archive`, {});
  }

  unarchive(id: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/unarchive`, {});
  }
}
