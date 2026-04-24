import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { noAuthGuard } from './auth/no-auth.guard';

export const routes: Routes = [
  // Auth screens — outside the shell, redirect away if already logged in
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      )
  },
  {
    path: 'register',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./auth/register/register.component').then((m) => m.RegisterComponent)
  },
  // Protected shell
  {
    path: '',
    loadComponent: () =>
      import('./core/shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
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
    ]
  }
];
