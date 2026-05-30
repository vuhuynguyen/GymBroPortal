/** API DTOs for `/api/workout-plans` (camelCase JSON). */

export interface WorkoutPlanSummaryDto {
  id: string;
  templateId: string;
  version: number;
  name: string;
  description: string | null;
  durationWeeks: number | null;
  workoutsPerWeek: number | null;
  createdOnUtc: string;
  workoutCount: number;
}

export interface WorkoutPlanListResponseDto {
  items: WorkoutPlanSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export type MyPlanVisibilityMode = 'Full' | 'Guided' | 'Blind';

export interface MyAssignedPlanDto {
  id: string;
  planId?: string;
  name?: string;
  coachName?: string | null;
  daysPerWeek?: number | null;
  visibilityMode?: MyPlanVisibilityMode | null;
}

export interface MyPlanDto {
  id: string;
  name: string;
  daysPerWeek?: number | null;
}

/** Serialized with `System.Text.Json` + camelCase string enums (`working`, `warmup`, …). */
export type PlanSetTypeApi = 'warmup' | 'working' | 'drop' | 'amrap';

export interface PlanSetDetailDto {
  id: string;
  order: number;
  setType: PlanSetTypeApi;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetRpe: number | null;
  targetDurationSeconds: number | null;
  restSeconds: number;
}

export interface PlanWorkoutExerciseDetailDto {
  id: string;
  exerciseId: string;
  exerciseName: string | null;
  order: number;
  sets: PlanSetDetailDto[];
}

export interface PlanWorkoutDetailDto {
  id: string;
  order: number;
  name: string;
  exercises: PlanWorkoutExerciseDetailDto[];
}

export interface WorkoutPlanDetailDto {
  id: string;
  templateId: string;
  version: number;
  name: string;
  description: string | null;
  durationWeeks: number | null;
  workoutsPerWeek: number | null;
  createdOnUtc: string;
  workouts: PlanWorkoutDetailDto[];
}

export interface CreateWorkoutPlanRequest {
  name: string;
  description?: string | null;
  durationWeeks?: number | null;
  workoutsPerWeek?: number | null;
}

export interface UpdateWorkoutPlanRequest {
  name: string;
  description?: string | null;
  durationWeeks?: number | null;
  workoutsPerWeek?: number | null;
}

/** PUT `/api/workout-plans/{id}/structure` — each exercise has a list of prescribed sets. */
export interface PlanSetRequest {
  setType: PlanSetTypeApi;
  targetReps?: number | null;
  targetWeightKg?: number | null;
  targetRpe?: number | null;
  targetDurationSeconds?: number | null;
  restSeconds: number;
  order: number;
}

export interface PlanWorkoutExerciseRequest {
  exerciseId: string;
  order: number;
  sets: PlanSetRequest[];
}

export interface PlanWorkoutStructureRequest {
  name: string;
  order: number;
  exercises: PlanWorkoutExerciseRequest[];
}

export interface ReplaceWorkoutPlanStructureRequest {
  workouts: PlanWorkoutStructureRequest[];
}
