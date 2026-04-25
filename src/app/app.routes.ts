import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { noAuthGuard } from './core/auth/no-auth-guard';
import { adminGuard } from './core/auth/role-guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then(
        (m) => m.ForgotPasswordComponent
      )
  },
  {
    path: 'register',
    canActivate: [noAuthGuard],
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.RegisterComponent)
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/app-shell').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'workspace/plans', pathMatch: 'full' },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.SettingsComponent)
      },
      {
        path: 'exercises',
        canActivate: [adminGuard()],
        loadChildren: () =>
          import('./features/exercises/exercises.routes').then((m) => m.exercisesRoutes)
      },
      {
        path: 'workspace',
        children: [
          {
            path: 'plans',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./features/workspace/plans/plans-list/plans-list').then((m) => m.PlansListComponent)
              },
              { path: 'new', redirectTo: '', pathMatch: 'full' },
              {
                path: ':planId',
                loadComponent: () =>
                  import('./features/workspace/plans/plan-builder/plan-builder').then((m) => m.PlanBuilderComponent)
              }
            ]
          },
          {
            path: 'plan-assignments',
            loadComponent: () =>
              import('./features/workspace/plan-assignments/plan-assignments').then(
                (m) => m.PlanAssignmentsComponent
              )
          },
          {
            path: 'logs',
            loadComponent: () =>
              import('./features/workspace/logs/logs').then((m) => m.LogsComponent)
          },
          {
            path: 'clients',
            loadComponent: () =>
              import('./features/workspace/clients/clients').then((m) => m.ClientsComponent)
          },
          { path: 'invite', redirectTo: 'clients', pathMatch: 'full' },
          // legacy redirect
          { path: 'members', redirectTo: 'clients', pathMatch: 'full' },
          {
            path: 'trainer/:trainerId/plans',
            loadComponent: () =>
              import('./features/workspace/trainer-plans/trainer-plans').then(
                (m) => m.TrainerPlansComponent
              )
          }
        ]
      },
      {
        path: 'admin',
        canActivate: [adminGuard()],
        children: [
          {
            path: 'tenants',
            loadComponent: () =>
              import('./features/admin/tenants/tenants').then((m) => m.TenantsComponent)
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./features/admin/users/users').then((m) => m.UsersComponent)
          }
        ]
      }
    ]
  }
];
