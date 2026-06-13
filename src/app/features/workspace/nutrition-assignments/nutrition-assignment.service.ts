import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  nutritionVisibilityToLabel,
  nutritionVisibilityToValue
} from '../nutrition-plans/nutrition-enums';
import type {
  CreateNutritionAssignmentRequest,
  NutritionAssignmentListResponseDto,
  NutritionAssignmentSummaryDto,
  UpdateNutritionAssignmentRequest
} from './nutrition-assignment.model';

/**
 * Typed calls against `/api/nutrition/assignments` — sibling of PlanAssignmentService. Supports
 * list + create + edit/revoke + pause/resume (mirrors the workout assignment surface).
 */
@Injectable({ providedIn: 'root' })
export class NutritionAssignmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/nutrition/assignments';

  list(params?: {
    traineeId?: string;
    activeOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Observable<NutritionAssignmentListResponseDto> {
    let query = new HttpParams();
    if (params?.traineeId?.trim()) query = query.set('traineeId', params.traineeId.trim());
    if (params?.activeOnly) query = query.set('activeOnly', 'true');
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return this.http
      .get<{
        items: Array<Omit<NutritionAssignmentSummaryDto, 'visibilityMode'> & { visibilityMode: unknown }>;
        page: number;
        pageSize: number;
        totalCount: number;
      }>(this.baseUrl, { params: query })
      .pipe(
        map((response) => ({
          ...response,
          items: response.items.map((item) => ({
            ...item,
            visibilityMode: nutritionVisibilityToLabel(item.visibilityMode) ?? 'Full'
          }))
        }))
      );
  }

  create(body: CreateNutritionAssignmentRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, {
      ...body,
      endDate: body.endDate || null,
      visibilityMode: nutritionVisibilityToValue(body.visibilityMode)
    });
  }

  update(assignmentId: string, body: UpdateNutritionAssignmentRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${assignmentId}`, {
      ...body,
      endDate: body.endDate || null,
      visibilityMode: nutritionVisibilityToValue(body.visibilityMode)
    });
  }

  revoke(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${assignmentId}`);
  }

  pause(assignmentId: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${assignmentId}/pause`, {});
  }

  resume(assignmentId: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${assignmentId}/resume`, {});
  }

  /** Re-point the assignment to the plan's latest published version (snapshot rebuilt server-side). */
  applyLatestVersion(assignmentId: string): Observable<{ updated: boolean }> {
    return this.http.put<{ updated: boolean }>(`${this.baseUrl}/${assignmentId}/apply-latest`, {});
  }
}
