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

export interface PlanWorkoutExerciseDetailDto {
  id: string;
  exerciseId: string;
  exerciseName: string | null;
  sets: number;
  reps: number;
  restSeconds: number;
  order: number;
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

export interface PlanWorkoutExerciseRequest {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  order: number;
}

export interface PlanWorkoutStructureRequest {
  name: string;
  order: number;
  exercises: PlanWorkoutExerciseRequest[];
}

export interface ReplaceWorkoutPlanStructureRequest {
  workouts: PlanWorkoutStructureRequest[];
}
