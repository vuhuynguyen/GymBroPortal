import { Routes } from '@angular/router';

export const exercisesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./exercise-list/exercise-list').then(
        (c) => c.ExerciseListComponent
      )
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./exercise-form/exercise-form').then(
        (c) => c.ExerciseFormComponent
      )
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./exercise-form/exercise-form').then(
        (c) => c.ExerciseFormComponent
      )
  }
];
