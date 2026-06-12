import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CreateCustomFoodRequest,
  CreateCustomFoodResponse,
  FoodDto,
  FoodListResponseDto
} from './food.model';

/** Typed reads against the food/supplement catalog (`/api/foods`) — sibling of ExerciseService. */
@Injectable({ providedIn: 'root' })
export class FoodService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/foods';

  search(params?: {
    search?: string;
    kind?: string;
    page?: number;
    pageSize?: number;
  }): Observable<FoodListResponseDto> {
    let query = new HttpParams();
    if (params?.search?.trim()) query = query.set('search', params.search.trim());
    if (params?.kind?.trim()) query = query.set('kind', params.kind.trim());
    if (params?.page) query = query.set('page', String(params.page));
    if (params?.pageSize) query = query.set('pageSize', String(params.pageSize));
    return this.http.get<FoodListResponseDto>(this.baseUrl, { params: query });
  }

  getById(id: string): Observable<FoodDto> {
    return this.http.get<FoodDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create a gym-catalog custom food (`POST /api/foods/custom`, Owner perm `NutritionPlanCreate`,
   * tenant-scoped via `X-Tenant-Id`). Returns the new food id so the caller can add it as a plan item.
   */
  createCustom(body: CreateCustomFoodRequest): Observable<CreateCustomFoodResponse> {
    return this.http.post<CreateCustomFoodResponse>(`${this.baseUrl}/custom`, body);
  }
}
