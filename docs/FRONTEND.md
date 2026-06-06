# GymBroPortal — Frontend Guide

> **Purpose:** The one necessary frontend doc — stack, structure, UI/design rules, state & HTTP, routing, and the Figma workflow.
> **Read when:** Building or changing any Angular page, component, service, route, or design token.
> **Answers:** How is the SPA structured? What are the non-negotiable UI rules? Which wrappers/patterns do I reuse? How do I wire tenant + auth?
> **Related (system facts live in the central SSOT):** [`../../docs/README.md`](../../docs/README.md) → MODULES (endpoints), PERMISSIONS (who-can-do-what), USER_FLOWS, BUSINESS_RULES. Repo conventions: [`../CLAUDE.md`](../CLAUDE.md).
> The exhaustive component catalog and token list are **not** duplicated here — the source of truth is the code: `src/app/shared/ui/`, `src/styles.scss`, and `src/app/core/config/prime-ng.config.ts`.

## Stack
Angular 21 · standalone components · **signals** · `ChangeDetectionStrategy.OnPush` · PrimeNG 21 (Aura preset remapped to **blue**) · Tailwind with `--inv-*` design tokens. Zone-based change detection (not zoneless). API base is the relative `/api` prefix via `proxy.conf.json` (dev) — no `environment*.ts`.

## Structure (three buckets only — do not add new top-level folders)
```
src/app/
├── core/      # singletons: auth/ (service, JWT decode, authInterceptor, guards), tenant/, layout/ (shell + side panels), config/ (prime-ng.config.ts)
├── features/  # route-level pages: auth/, exercises/ (admin-gated), workspace/ (plans + plan-builder, plan-assignments, logs + active-session, clients/invites, trainer-plans), admin/, settings/
└── shared/ui/ # dumb, stateless wrapper components
```
Auth **pages** live in `features/auth/`; auth **infra** (guards, interceptor, service) in `core/auth/`.
**Empty/unrouted (do not extend):** `features/popup-showcase/`, `features/workspace/workout-plans/`. Member/invite management lives in `features/workspace/clients/` + the `core/layout/*-gymbro-panel` side panels — there are no separate `members`/`invite`/`dashboard` route folders.

## Hard rules
- **`inv-*` design tokens only** — no hex colors in feature code. Blue primary (no purple as brand).
- **No raw PrimeNG** (`p-button`, `p-dropdown`, …) in feature templates — always use a `shared/ui/` wrapper.
- **Reactive forms** (`FormBuilder` + typed `FormGroup`) for new code. ⚠ **Known drift:** several existing components use template-driven `ngModel` (auth screens + some side panels/dialogs), and `exercise-form` uses the experimental `@angular/forms/signals` API — these predate this rule and aren't migrated yet. Don't add new template-driven forms.
- **Signals + OnPush + standalone** — no `NgModule`, no `BehaviorSubject` + `async` pipe for new code.
- **State in services** (`signal`/`computed`); components stay thin and read service signals.

## Mandatory shared UI wrappers (`src/app/shared/ui/` — check here before writing a component)
`app-button`, `app-input`, `app-select` (string lists; **never `p-dropdown`**), `app-form-field`,
`app-page-header`, `app-ui-page-container`, `app-ui-page-sticky-footer`, `app-ui-panel-card`,
`app-data-table` + `appDataTableCell`, `app-filter-bar`, `app-ui-form-grid`, `app-ui-form-inline`,
`app-chip-removable-list`, `app-confirm-split-dialog`, `app-success-dialog`, `app-info-dialog`.

## Page patterns
```ts
@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [...] })
export class MyPageComponent implements OnInit {
  private readonly service = inject(MyService);
  readonly data = this.service.data;       // signal
  readonly loading = this.service.loading; // signal
  ngOnInit() { this.service.load(); }
}
```
- **List/table page:** mirror `features/exercises/exercise-list` — `app-ui-page-container` → `app-page-header` (actions in `.ui-page-actions`) → `app-data-table`.
- **Full-page editor (save/cancel):** mirror `features/exercises/exercise-form` — outer `<section>` with bottom padding → `app-ui-page-container` → stacked `app-ui-panel-card` sections → `app-ui-page-sticky-footer` (outlined-secondary cancel/back + primary save `pi-check`).
- **Workout Log timeline (v4):** `features/workspace/logs` is a session-first timeline, not a table — full-bleed active-session banner → `.v4-grid` (main column = filter chips + Monday-anchored collapsible week-groups of session rows; sticky right rail = This-week goal ring / Program / Jump-to-week). Tapping a completed/abandoned row opens `session-detail-dialog` (centered modal, fetches `SessionDetailDto`); in-progress rows route to `active-session`. Local atoms: `completion-ring` (SVG goal ring). Weights/volume render in **kg** (stored unit). The `.v4-*` styles intentionally use pill chips + a ring (a documented divergence from the pills/ring ban) for this approved redesign.

## State, HTTP & tenancy
- Core service signals: `AuthService` (`token`, `profile` from `GET /api/auth/me`, computed `isAuthenticated`/`isPlatformAdmin`/`currentUser` — `isPlatformAdmin` falls back to the JWT `is_admin` claim until `/me` returns), `TenantService` (`tenants[]`, `activeTenantId`, computed `currentRole`/`activeTenant`/`ownTenant`/`trainerWorkspaces`), plus per-feature services.
- `authInterceptor` adds `Authorization: Bearer` + `X-Tenant-Id` (from `TenantService.activeTenant()`) automatically.
- `errorInterceptor` on a **401** from a non-auth call **silently refreshes once and replays** the request (single-flight); it logs the user out only if the refresh fails. Other HTTP errors show a toast. Token lifecycle: [`../../docs/REFRESH_TOKEN_DESIGN.md`](../../docs/REFRESH_TOKEN_DESIGN.md).
- **Tenant context:** `selectOwnWorkspace()` on trainer/management screens; `selectTrainerWorkspace(id)` before loading a coach's assigned plans (trainee view). `TenantService.ensureLoaded()` (idempotent, single-flight) is awaited by `authGuard`/`roleGuard` so a deep-link/refresh has tenants+role before activation; `loadTenants()` is the explicit post-mutation refresh. Stateful per-feature services reset their signals on tenant switch (no cross-workspace bleed).

## Routing & guards (`app.routes.ts`)
Lazy routes. Public: `noAuthGuard` (`/login`, `/register`, `/forgot-password`, `/reset-password`). Shell: `authGuard` (profile loads once in `AuthService`, not per navigation). `adminGuard()` gates `/exercises` and `/admin/*` (catalog management is **platform-admin-only in the UI**). `roleGuard(['Owner'])` gates trainer-only workspace routes (`/workspace/plans`, `/workspace/plan-assignments`, `/workspace/clients`). Trainees read their assigned plans through the **un-guarded** `/workspace/trainer/:trainerId/plans` (list) and `/workspace/trainer/:trainerId/plans/:planId` (read-only `PlanViewComponent`) — the API redacts plan content per the assignment's visibility flags, so these are safe without an Owner guard (`/workspace/plans/:id` remains the Owner-only editor). The UI gates are `adminGuard`/`roleGuard` reading `AuthService.isPlatformAdmin()` + `TenantService.currentRole()` — **defense-in-depth only; the API is the real authorization boundary** (the frontend has no permission matrix to keep in sync — see [`../../docs/PERMISSIONS.md`](../../docs/PERMISSIONS.md)).

## Figma Make workflow (critical)
Figma Make exports **React + Tailwind**; this app is Angular. Never convert JSX directly:
1. Extract **visual intent** from `App.tsx` (layout, spacing, section order).
2. Map to `shared/ui/` components + `inv-*` tokens (no hex, no raw PrimeNG).
3. Build with Angular patterns (reactive forms, signals, standalone).
4. After adding new Tailwind responsive classes: `rm -rf .angular/cache && ng serve`.
