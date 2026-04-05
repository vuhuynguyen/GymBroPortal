import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'exercises', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent)
  },
  {
    path: 'exercises',
    loadChildren: () =>
      import('./exercises/exercises.routes').then((m) => m.exercisesRoutes)
  }
];
