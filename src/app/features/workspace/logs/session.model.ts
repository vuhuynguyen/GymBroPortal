export type SessionStatus = 'InProgress' | 'Completed' | 'Abandoned';
export type SessionSource = 'FromAssignment' | 'Adhoc';
export type SetType = 'Warmup' | 'Working' | 'Drop' | 'AMRAP' | 'Failure';
export type ExerciseStatus = 'InProgress' | 'Completed' | 'Skipped' | 'Substituted';

export interface SessionSummaryDto {
  id: string;
  traineeId: string;
  traineeName: string | null;
  source: SessionSource;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  totalSets: number;
  totalExercises: number;
  rpeOverall: number | null;
  planAssignmentId: string | null;
  workoutName: string | null;
}

export interface SessionListResponseDto {
  items: SessionSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SessionSnapshotSetDto {
  planSetId: string;
  order: number;
  setType: SetType;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
}

export interface SessionSnapshotExerciseDto {
  planWorkoutExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: SessionSnapshotSetDto[];
}

export interface SessionSnapshotDto {
  workoutName: string;
  exercises: SessionSnapshotExerciseDto[];
}

export interface PerformedSetDto {
  id: string;
  planSetId: string | null;
  setNumber: number;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  restSeconds: number | null;
  isCompleted: boolean;
  estimatedOneRepMaxKg: number | null;
  loggedAt: string;
}

export interface PerformedExerciseDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  status: ExerciseStatus;
  substitutedFromExerciseId?: string | null;
  substitutedFromExerciseName?: string | null;
  notes?: string | null;
  sets: PerformedSetDto[];
}

export interface ActiveSessionDto {
  sessionId: string;
  status: SessionStatus;
  startedAt: string;
  source: SessionSource;
  snapshot: SessionSnapshotDto | null;
  exercises: PerformedExerciseDto[];
  workoutNameSnapshot?: string | null;
  planAssignmentId?: string | null;
}

export interface SessionDetailDto {
  id: string;
  traineeId: string;
  source: SessionSource;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  rpeOverall: number | null;
  bodyweightKg: number | null;
  notes: string | null;
  clientTimezone: string | null;
  planAssignmentId: string | null;
  plannedWorkoutId: string | null;
  workoutNameSnapshot: string | null;
  exercises: PerformedExerciseDto[];
}

export interface StartSessionRequest {
  source: SessionSource;
  planAssignmentId?: string | null;
  plannedWorkoutId?: string | null;
  clientTimezone: string;
  bodyweightKg?: number | null;
}

export interface StartSessionResponse {
  sessionId: string;
  status: SessionStatus;
  startedAt: string;
  source: SessionSource;
  snapshot: SessionSnapshotDto | null;
}

export interface AddExerciseRequest {
  exerciseId: string;
  planWorkoutExerciseId?: string | null;
  order: number;
  notes?: string | null;
}

export interface LogSetRequest {
  planSetId?: string | null;
  setNumber: number;
  setType: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
  restSeconds?: number | null;
  isCompleted: boolean;
}

export interface CompleteSessionRequest {
  rpeOverall?: number | null;
  notes?: string | null;
  completedAt?: string | null;
}

export interface ListSessionsParams {
  traineeId?: string;
  from?: string;
  to?: string;
  status?: SessionStatus;
  planAssignmentId?: string;
  page?: number;
  pageSize?: number;
}
