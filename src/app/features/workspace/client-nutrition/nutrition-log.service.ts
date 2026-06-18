import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  DailyNutritionLogDetailDto,
  DailyNutritionLogListResponseDto
} from './nutrition-log.model';

/**
 * Coach adherence reads against `/api/nutrition/logs` (tenant-scoped, NutritionLogViewAll-gated on the
 * API) — sibling of SessionService's coach surface (`listForClient`/`getById`).
 */
@Injectable({ providedIn: 'root' })
export class NutritionLogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/nutrition/logs';

  listForClient(
    traineeId: string,
    params?: { from?: string; to?: string; page?: number; pageSize?: number }
  ): Observable<DailyNutritionLogListResponseDto> {
    let query = new HttpParams().set('traineeId', traineeId);
    if (params?.from) query = query.set('from', params.from);
    if (params?.to) query = query.set('to', params.to);
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return this.http.get<DailyNutritionLogListResponseDto>(this.baseUrl, { params: query });
  }

  getDay(traineeId: string, date: string): Observable<DailyNutritionLogDetailDto> {
    return this.http.get<DailyNutritionLogDetailDto>(`${this.baseUrl}/${date}`, {
      params: new HttpParams().set('traineeId', traineeId)
    });
  }
}
