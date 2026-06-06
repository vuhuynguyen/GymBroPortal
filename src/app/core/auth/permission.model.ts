export type Permission =
  // Plans
  | 'PlanCreate'
  | 'PlanUpdate'
  | 'PlanDelete'
  | 'PlanAssign'
  | 'PlanView'
  | 'PlanViewAll'
  // Clients
  | 'ClientView'
  | 'ClientRemove'
  | 'InviteCreate'
  // Workout Logs
  | 'WorkoutLogCreate'
  | 'WorkoutLogViewOwn'
  | 'WorkoutLogViewAll';
