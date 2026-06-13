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
  isArchived: boolean;
  /** The head row is an unpublished draft (has edits not yet published). */
  isDraft: boolean;
  /** Latest published version of this template; null when never published (draft-only, not assignable). */
  latestPublishedVersion: number | null;
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
  /** ISO date the coach set the plan to begin — drives the "Started" tile and week progress. */
  startDate?: string | null;
  visibilityMode?: MyPlanVisibilityMode | null;
  /** Per-assignment visibility options the coach set; reflected in the trainee plan view. */
  hideExercises?: boolean;
  hideSetsReps?: boolean;
  hideFutureWorkouts?: boolean;
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
  targetDistanceM?: number | null;
  targetRounds?: number | null;
  restSeconds: number;
}

export interface PlanWorkoutExerciseDetailDto {
  id: string;
  exerciseId: string;
  exerciseName: string | null;
  order: number;
  sets: PlanSetDetailDto[];
  supersetGroupId?: string | null;
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
  /** The head row is an unpublished draft (has edits not yet published). */
  isDraft: boolean;
  /** Latest published version of this template; null when never published. */
  latestPublishedVersion: number | null;
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
  targetDistanceM?: number | null;
  targetRounds?: number | null;
  restSeconds: number;
  order: number;
}

export interface PlanWorkoutExerciseRequest {
  exerciseId: string;
  order: number;
  sets: PlanSetRequest[];
  supersetGroupId?: string | null;
}

export interface PlanWorkoutStructureRequest {
  name: string;
  order: number;
  exercises: PlanWorkoutExerciseRequest[];
}

/**
 * PUT `/api/workout-plans/{id}/structure` carries metadata + structure together so a builder save lands as
 * ONE new version (two version-forking PUTs would make the second one target a stale id → 409).
 */
export interface ReplaceWorkoutPlanStructureRequest {
  name: string;
  description?: string | null;
  durationWeeks?: number | null;
  workoutsPerWeek?: number | null;
  workouts: PlanWorkoutStructureRequest[];
}

/** Both edit PUTs fork a new version and return its id so the client can re-point to the latest. */
export interface WorkoutPlanVersionRef {
  id: string;
}
