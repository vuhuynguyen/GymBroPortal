import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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
    return this.http.get<PlanAssignmentListResponseDto>(this.baseUrl, { params: query });
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
}
