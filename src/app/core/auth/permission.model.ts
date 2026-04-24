export type Permission =
  // Plans
  | 'PlanCreate'
  | 'PlanUpdate'
  | 'PlanDelete'
  | 'PlanAssign'
  | 'PlanView'
  // Clients
  | 'ClientView'
  | 'ClientRemove'
  | 'InviteCreate'
  // Workout Logs
  | 'WorkoutLogCreate'
  | 'WorkoutLogViewOwn'
  | 'WorkoutLogViewAll';
