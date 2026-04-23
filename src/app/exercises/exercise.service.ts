import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize } from 'rxjs';
import {
  DIFFICULTIES,
  EQUIPMENT,
  EXERCISE_TYPES,
  ExerciseDetailDto,
  ExerciseDto,
  MUSCLE_GROUPS,
  MOVEMENT_TYPES,
  MuscleGroup,
  SaveExerciseRequest
} from './exercise.model';

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/exercises';

  /** Catalog rows from the last successful search (or initial load). */
  readonly exercises = signal<ExerciseDto[]>([]);
  readonly loading = signal(false);

  readonly exerciseTypes = EXERCISE_TYPES;
  readonly movementTypes = MOVEMENT_TYPES;
  readonly muscleGroups: MuscleGroup[] = [...MUSCLE_GROUPS];
  readonly equipmentList = EQUIPMENT;
  readonly difficulties = DIFFICULTIES;

  /**
   * Loads the first page of exercises (aligned with `SearchExercisesQuery`).
   * Optional `search` maps to the `Search` query parameter.
   */
  load(search?: string, pageSize = 100): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', '1').set('pageSize', String(pageSize));
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    this.http
      .get<ExerciseDto[]>(this.baseUrl, { params })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => this.exercises.set(rows),
        error: () => this.exercises.set([])
      });
  }

  getById(id: string): Observable<ExerciseDetailDto> {
    return this.http.get<ExerciseDetailDto>(`${this.baseUrl}/${id}`);
  }

  create(body: SaveExerciseRequest): Observable<string> {
    return this.http.post<string>(this.baseUrl, body);
  }

  update(id: string, body: SaveExerciseRequest): Observable<string> {
    return this.http.put<string>(`${this.baseUrl}/${id}`, body);
  }
}
