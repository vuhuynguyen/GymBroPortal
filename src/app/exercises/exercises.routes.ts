import { Routes } from '@angular/router';

export const exercisesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./exercise-list/exercise-list.component').then(
        (c) => c.ExerciseListComponent
      )
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./exercise-form/exercise-form.component').then(
        (c) => c.ExerciseFormComponent
      )
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./exercise-form/exercise-form.component').then(
        (c) => c.ExerciseFormComponent
      )
  }
];
