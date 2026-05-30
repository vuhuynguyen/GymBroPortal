export type PlanVisibilityMode = 'Full' | 'Guided' | 'Blind';

export interface TraineeOption {
  id: string;
  name: string;
}

export interface PlanAssignmentSummaryDto {
  id: string;
  traineeId: string;
  planId: string;
  planVersion: number;
  latestPlanVersion: number;
  hasNewerVersion: boolean;
  startDate: string;
  frequencyDaysPerWeek: number;
  visibilityMode: PlanVisibilityMode;
  hideExercises: boolean;
  hideSetsReps: boolean;
  hideFutureWorkouts: boolean;
  disableTraineeEditing: boolean;
  isCustomized: boolean;
}

export interface PlanAssignmentListResponseDto {
  items: PlanAssignmentSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CreatePlanAssignmentRequest {
  traineeId: string;
  planId: string;
  startDate: string;
  frequencyDaysPerWeek: number;
  visibilityMode: PlanVisibilityMode;
  hideExercises: boolean;
  hideSetsReps: boolean;
  hideFutureWorkouts: boolean;
  disableTraineeEditing: boolean;
  snapshotJson?: string | null;
}

export interface UpdatePlanAssignmentRequest {
  startDate?: string;
  frequencyDaysPerWeek: number;
  visibilityMode: PlanVisibilityMode;
  hideExercises: boolean;
  hideSetsReps: boolean;
  hideFutureWorkouts: boolean;
  disableTraineeEditing: boolean;
}
