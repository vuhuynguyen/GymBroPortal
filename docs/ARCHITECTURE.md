# GymBro Portal — Frontend Architecture

Structure, UI rules, state, HTTP/tenancy, routing, and the design workflow for the Angular client.

The exhaustive component catalog and token list are **not** duplicated here — the source of truth is the code:
`src/app/shared/ui/`, `src/styles.scss`, and `src/app/core/config/prime-ng.config.ts`. The API contract,
permissions, and business rules are owned by the **GymBro API** repository.

## Stack

Angular 21 · standalone components · **signals** · `ChangeDetectionStrategy.OnPush` · PrimeNG 21 (Aura preset
remapped to **blue**) · Tailwind with `--inv-*` design tokens. Zone-based change detection (not zoneless). The API
base is the relative `/api` prefix (via `proxy.conf.json` in dev, nginx in prod); the API version is negotiated by
header, so there is no `environment*.ts`.

## Structure (three buckets only — do not add new top-level folders)

```
src/app/
├── core/      # singletons: auth/ (service, JWT decode, authInterceptor, guards), tenant/, layout/ (shell + side panels), config/
├── features/  # route-level pages: auth/, exercises/ (admin-gated), workspace/ (plans + plan-builder, plan-assignments, logs + active-session, clients/invites + client-workouts, trainer-plans), admin/, settings/
└── shared/ui/ # dumb, stateless wrapper components
```

Auth **pages** live in `features/auth/`; auth **infra** (guards, interceptor, service) in `core/auth/`. Member and
invite management lives in `features/workspace/clients/` plus the `core/layout/*-gymbro-panel` side panels — there
are no separate `members`/`invite`/`dashboard` route folders. `features/popup-showcase/` and
`features/workspace/workout-plans/` are empty/unrouted — do not extend them.

## Hard rules

- **`inv-*` design tokens only** — no hex colors in feature code. Blue primary (no purple as brand).
- **No raw PrimeNG** (`p-button`, `p-dropdown`, …) in feature templates — always use a `shared/ui/` wrapper.
- **Reactive forms** (`FormBuilder` + typed `FormGroup`) for new code. Several existing components still use template-driven `ngModel` (auth screens, some side panels/dialogs) and `exercise-form` uses the experimental `@angular/forms/signals` API — these predate the rule and aren't migrated. Don't add new template-driven forms.
- **Signals + OnPush + standalone** — no `NgModule`, no `BehaviorSubject` + `async` pipe for new code.
- **State in services** (`signal`/`computed`); components stay thin and read service signals.

## Mandatory shared UI wrappers (`src/app/shared/ui/` — check here before writing a component)

`app-button`, `app-input`, `app-select` (string lists; never `p-dropdown`), `app-form-field`, `app-page-header`,
`app-ui-page-container`, `app-ui-page-sticky-footer`, `app-ui-panel-card`, `app-data-table` + `appDataTableCell`,
`app-filter-bar`, `app-ui-form-grid`, `app-ui-form-inline`, `app-chip-removable-list`, `app-confirm-split-dialog`,
`app-success-dialog`, `app-info-dialog`.

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
- **Full-page editor (save/cancel):** mirror `features/exercises/exercise-form` — outer `<section>` with bottom padding → `app-ui-page-container` → stacked `app-ui-panel-card` sections → `app-ui-page-sticky-footer` (outlined-secondary cancel/back + primary save).
- **Workout Log timeline:** `features/workspace/logs` is a session-first timeline, not a table — full-bleed active-session banner → `.v4-grid` (main column = filter chips + Monday-anchored collapsible week-groups of session rows; sticky right rail = this-week goal ring / program / jump-to-week). Tapping a completed/abandoned row opens `session-detail-dialog`; in-progress rows route to `active-session`. Weights/volume render in **kg** (the stored unit). The `.v4-*` styles intentionally use pill chips + a ring — an approved divergence from the general pills/ring ban for this redesign.

## State, HTTP & tenancy

- **Core service signals:** `AuthService` (`token`, `profile` from `GET /api/auth/me`, computed `isAuthenticated`/`isPlatformAdmin`/`currentUser` — `isPlatformAdmin` falls back to the JWT `is_admin` claim until `/me` returns), `TenantService` (`tenants[]`, `activeTenantId`, computed `currentRole`/`activeTenant`/`ownTenant`/`trainerWorkspaces`), plus per-feature services.
- **`authInterceptor`** adds `Authorization: Bearer` + `X-Tenant-Id` (from `TenantService.activeTenant()`) to every call automatically.
- **`errorInterceptor`** on a 401 from a non-auth call silently refreshes once and replays the request (single-flight); it logs the user out only if the refresh fails. Other HTTP errors show a toast.
- **Unified personal training (`api/me/*`):** the trainee/personal experience reads the user's own data across **all** gyms — `SessionService.listMine()` / `getMineById()` hit `GET /api/me/sessions[/{id}]`, and the active-session lookup (`GET /api/sessions/active`) is user-wide. These are independent of the active tenant (the `X-Tenant-Id` header is still attached but the API ignores it for `/me`). The **coach/owner** view of gym members stays tenant-scoped on `SessionService.list()` / `getById()` (`GET /api/sessions`). `LogsComponent` selects the source by `currentRole()` (Owner → coach/tenant-scoped; otherwise → personal/`/me`).
- **Tenant context:** `selectOwnWorkspace()` on trainer/management screens; `selectTrainerWorkspace(id)` before loading a coach's assigned plans (trainee view). `TenantService.ensureLoaded()` (idempotent, single-flight) is awaited by `authGuard`/`roleGuard` so a deep-link/refresh has tenants + role before activation; `loadTenants()` is the explicit post-mutation refresh. Stateful per-feature services reset their signals on tenant switch (no cross-workspace bleed).

## Routing & guards (`app.routes.ts`)

Lazy routes throughout.

- **Public** (`noAuthGuard`): `/login`, `/register`, `/forgot-password`, `/reset-password`.
- **Shell** (`authGuard`): the authenticated app; the profile loads once in `AuthService`, not per navigation.
- **`adminGuard()`** gates `/exercises` and `/admin/*` (catalog management is platform-admin-only in the UI).
- **`roleGuard(['Owner'])`** gates trainer-only workspace routes (`/workspace/plans`, `/workspace/plan-assignments`, `/workspace/clients`, and `/workspace/clients/:clientId/workouts` — the coach's **read-only** view of one client's session history + detail, tenant-scoped via `GET /api/sessions?traineeId=…` and the shared `session-detail-dialog`).
- Trainees read their assigned plans through the **un-guarded** `/workspace/trainer/:trainerId/plans` (list) and `/workspace/trainer/:trainerId/plans/:planId` (read-only `PlanViewComponent`) — the API redacts plan content per the assignment's visibility flags, so these are safe without an Owner guard. `/workspace/plans/:id` remains the Owner-only editor.

The UI gates read `AuthService.isPlatformAdmin()` + `TenantService.currentRole()` — **defense-in-depth only; the API
is the real authorization boundary.** The frontend keeps no permission matrix to sync.

## API integration

- Hand-written per-feature services issue typed `HttpClient` calls against the relative `/api`. Endpoint contracts are owned by the API repository.
- **Optional contract drift check:** `npm run check:api` regenerates a typed client from a committed `openapi.json` and fails if it drifts. It is a no-op until `openapi.json` is committed (export it from the backend's `/openapi/v1.json`). CI runs it. The app does not currently ship a generated client.

## Authentication flow

The access token is held in an **in-memory signal** (never `localStorage`). On app start the `AuthService`
constructor runs a **silent refresh** against the httpOnly `gymbro_refresh` cookie to restore the session; guards
await `auth.ready` before deciding, so a reload doesn't bounce a logged-in user. The full token lifecycle (rotation,
revocation) is owned by the API repository's authentication doc.

## Design workflow (Figma Make)

Figma Make exports **React + Tailwind**; this app is Angular. Never convert JSX directly:

1. Extract **visual intent** from `App.tsx` (layout, spacing, section order).
2. Map to `shared/ui/` components + `inv-*` tokens (no hex, no raw PrimeNG).
3. Build with Angular patterns (reactive forms, signals, standalone).
4. After adding new Tailwind responsive classes: `rm -rf .angular/cache && ng serve`.
