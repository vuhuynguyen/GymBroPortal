/** Matches `ExerciseDto` from GET `api/exercises` (camelCase JSON). */
export interface ExerciseDto {
  id: string;
  name: string;
  type: string;
  movementType: string;
  difficulty: string;
  equipment: string;
  estimatedCaloriesBurn: number | null;
  averageDurationSeconds: number | null;
  muscleGroup: string;
  imageUrl: string | null;
}

/** Matches `ExerciseMediaItemDto` from GET `api/exercises/{id}`. */
export interface ExerciseMediaItemDto {
  url: string;
  type: string;
}

/** Matches `ExerciseDetailDto` from GET `api/exercises/{id}`. */
export interface ExerciseDetailDto extends ExerciseDto {
  description: string;
  muscles: ExerciseMuscleItemDto[];
  instructions: string[];
  tags: string[];
  media: ExerciseMediaItemDto[];
  warnings: string[];
}

export interface ExerciseMuscleItemDto {
  muscle: string;
  isPrimary: boolean;
}

/** Single muscle entry for `CreateExerciseRequest.Muscles` / `ExerciseMuscleRequest`. */
export interface ExerciseMuscleRequestPayload {
  muscle: string;
  isPrimary: boolean;
}

/**
 * Request body for POST `api/exercises` and PUT `api/exercises/{id}` (see `CreateExerciseRequest`).
 * Prefer `muscles` (API maps it first); keep `muscleGroup` for legacy mapping on the server.
 */
export interface SaveExerciseRequest {
  name: string;
  description: string;
  type: string;
  movementType: string;
  difficulty: string;
  equipment: string;
  estimatedCaloriesBurn?: number | null;
  averageDurationSeconds?: number | null;
  imageUrl?: string | null;
  muscleGroup?: string | null;
  muscles?: ExerciseMuscleRequestPayload[];
  instructions?: string[];
  tags?: string[];
  media?: ExerciseMediaItemDto[];
  warnings?: string[];
}

/** Enum labels match `Modules.ExerciseModule.Entities` (API parses case-insensitively). */
export const EXERCISE_TYPES = ['Strength', 'Cardio', 'Mobility', 'Stretching'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const MOVEMENT_TYPES = ['Compound', 'Isolation'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['Bodyweight', 'Dumbbell', 'Barbell', 'Machine', 'ResistanceBand'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Matches `ExerciseMedia.Type` on the server (Image | Video). */
export const EXERCISE_MEDIA_TYPES = ['Image', 'Video'] as const;
export type ExerciseMediaType = (typeof EXERCISE_MEDIA_TYPES)[number];
