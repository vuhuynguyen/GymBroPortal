export type SessionStatus = 'InProgress' | 'Completed' | 'Abandoned';
export type SessionSource = 'FromAssignment' | 'Adhoc';
export type SetType = 'warmup' | 'working' | 'drop' | 'amrap' | 'failure';
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
  /** Working-set volume (Σ weight × reps), kg. */
  totalVolumeKg: number;
  /** Number of lifts that set a new estimated-1RM record in this session. */
  prCount: number;
  /** Owning program name when the session came from a plan assignment. */
  programName: string | null;
  /** 1-based plan week the session falls in (plan-sourced sessions only). */
  planWeek: number | null;
  /** Weekly session goal from the active plan's frequency (null for ad-hoc-only). */
  weeklyGoal: number | null;
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
  targetDurationSeconds?: number | null;
  targetDistanceM?: number | null;
  targetRounds?: number | null;
  restSeconds: number | null;
}

export interface SessionSnapshotExerciseDto {
  planWorkoutExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: SessionSnapshotSetDto[];
  supersetGroupId?: string | null;
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
  calories?: number | null;
  avgHeartRate?: number | null;
  rounds?: number | null;
  /** Set when this row is a stage of a drop/rest-pause cluster led by ParentSetId (counts as one set). */
  parentSetId?: string | null;
  rpe: number | null;
  restSeconds: number | null;
  isCompleted: boolean;
  estimatedOneRepMaxKg: number | null;
  loggedAt: string;
  /** True when this is the working set that set a new estimated-1RM PR for its lift. */
  isPr: boolean;
}

/**
 * The trainee's most recent PRIOR performance of a lift — the top working set of the last completed
 * session that included it. The live "last time" reference; null when there's no history. Computed
 * server-side on read, never the current session.
 */
export interface LastPerformedSetDto {
  weightKg: number | null;
  reps: number | null;
  performedAt: string;
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
  /** Logging mode (denormalized at add/substitute time) — drives which metric inputs to show. Defaults to Strength. */
  trackingType?: string;
  /** Exercises sharing a non-null group id are performed as a superset (rotated, rest after the round). */
  supersetGroupId?: string | null;
  /** Most recent prior performance of this lift (last completed session), or null when there's no history. */
  lastPerformed?: LastPerformedSetDto | null;
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

export interface SessionPrDto {
  exerciseId: string;
  exerciseName: string | null;
  weightKg: number;
  reps: number;
  estimatedOneRepMaxKg: number;
  previousEstimatedOneRepMaxKg: number | null;
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
  /** Working-set volume (Σ weight × reps), kg. */
  totalVolumeKg: number;
  /** Owning program name when the session came from a plan assignment. */
  programName: string | null;
  /** 1-based plan week the session falls in (plan-sourced sessions only). */
  planWeek: number | null;
  /** Lifts that set a new estimated-1RM record in this session. */
  prs: SessionPrDto[];
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
  /** Set when logging a drop/rest-pause stage of an existing lead set. */
  parentSetId?: string | null;
  setNumber: number;
  setType: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  calories?: number | null;
  avgHeartRate?: number | null;
  rounds?: number | null;
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
