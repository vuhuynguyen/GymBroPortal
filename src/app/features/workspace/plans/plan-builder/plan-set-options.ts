import type { PlanSetTypeApi } from '../workout-plan.model';

/** Prescribed set type dropdown — shared by plan builder form. */
export const PLAN_BUILDER_SET_TYPE_OPTIONS: ReadonlyArray<{ value: PlanSetTypeApi; label: string }> = [
  { value: 'warmup', label: 'Warmup' },
  { value: 'working', label: 'Working' },
  { value: 'drop', label: 'Drop' },
  { value: 'cluster', label: 'Cluster' },
  { value: 'amrap', label: 'AMRAP' }
];
