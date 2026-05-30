import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  CreatePlanAssignmentRequest,
  PlanVisibilityMode,
  PlanAssignmentListResponseDto,
  UpdatePlanAssignmentRequest
} from './plan-assignment.model';

@Injectable({ providedIn: 'root' })
export class PlanAssignmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/workout-plans/assignments';

  list(params?: { traineeId?: string; page?: number; pageSize?: number }): Observable<PlanAssignmentListResponseDto> {
    let query = new HttpParams();
    if (params?.traineeId?.trim()) query = query.set('traineeId', params.traineeId.trim());
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return this.http
      .get<{
        items: Array<{
          id: string;
          traineeId: string;
          planId: string;
          planVersion: number;
          latestPlanVersion: number;
          hasNewerVersion: boolean;
          startDate: string;
          frequencyDaysPerWeek: number;
          visibilityMode: PlanVisibilityMode | number;
          isCustomized: boolean;
        }>;
        page: number;
        pageSize: number;
        totalCount: number;
      }>(this.baseUrl, { params: query })
      .pipe(
        map((response) => ({
          ...response,
          items: response.items.map((item) => ({
            ...item,
            visibilityMode: this.toVisibilityModeLabel(item.visibilityMode)
          }))
        }))
      );
  }

  create(body: CreatePlanAssignmentRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, {
      ...body,
      visibilityMode: this.toVisibilityModeValue(body.visibilityMode)
    });
  }

  update(assignmentId: string, body: UpdatePlanAssignmentRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${assignmentId}`, {
      ...body,
      visibilityMode: this.toVisibilityModeValue(body.visibilityMode)
    });
  }

  revoke(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${assignmentId}`);
  }

  applyLatestVersion(assignmentId: string, snapshotJson?: string | null): Observable<{ updated: boolean }> {
    return this.http.put<{ updated: boolean }>(`${this.baseUrl}/${assignmentId}/apply-latest`, {
      snapshotJson: snapshotJson ?? null
    });
  }

  private toVisibilityModeValue(mode: PlanVisibilityMode): number {
    switch (mode) {
      case 'Full':
        return 1;
      case 'Guided':
        return 2;
      case 'Blind':
        return 3;
      default:
        return 2;
    }
  }

  private toVisibilityModeLabel(mode: PlanVisibilityMode | number): PlanVisibilityMode {
    if (mode === 'Full' || mode === 1) return 'Full';
    if (mode === 'Guided' || mode === 2) return 'Guided';
    if (mode === 'Blind' || mode === 3) return 'Blind';
    return 'Guided';
  }
}
