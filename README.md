# GymBro Portal

> Web client for **GymBro**, a multi-tenant fitness-coaching platform — coaches plan and assign workouts,
> trainees log sessions and track progress.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Signals](https://img.shields.io/badge/state-signals%20%2B%20OnPush-3fb950)
![PrimeNG](https://img.shields.io/badge/UI-PrimeNG%2021%20%2B%20Tailwind-06B6D4)

This is the single-page web app trainers and trainees actually use: a coach builds versioned workout programs in a
drag-friendly plan builder, assigns them with per-trainee visibility, and watches progress; a trainee runs the
assigned workout live and logs every set. It talks to the **GymBro API** (a separate repository) over a small,
header-authenticated REST surface.

**Status:** MVP. The full coaching loop — onboarding, plan building, assignment, live session logging, and a
progress timeline — is implemented and deployed (nginx-served container behind the API on one origin).

## Key features

- **Auth & onboarding** — register / log in, then land in your own workspace; join a coach's workspace by invite code.
- **Plan builder** — author multi-workout programs (exercises → prescribed sets) that version immutably on each save.
- **Assignments** — assign a plan to a client with visibility controls; "Train this myself" for self-coaching.
- **Live session** — start the assigned (or an ad-hoc) workout, log sets, substitute or skip exercises, complete or cancel.
- **Progress timeline** — a session-first log view with weekly goal rings, training volume, and personal records, all computed client-side.
- **Admin** — platform admins manage the global exercise catalog and tenants/users.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Angular 21 · standalone components · `OnPush` |
| State | Signals + `computed` in services (no NgRx, no `NgModule`) |
| UI | PrimeNG 21 (themed blue) + Tailwind with `inv-*` design tokens |
| Forms | Reactive forms |
| Auth | In-memory access token + silent refresh; HTTP interceptors |

## Architecture & structure

Standalone components with `OnPush` change detection; **all state lives in service signals** and components stay
thin. Exactly three top-level buckets:

```
src/app/
├── core/      # singletons: auth/ (service, interceptors, guards), tenant/, layout/ (shell + side panels), config/
├── features/  # route-level pages: auth, exercises, workspace (plans, assignments, logs, clients), admin, settings
└── shared/ui/ # mandatory dumb wrapper components (app-button, app-data-table, dialogs, …)
```

The full frontend guide — UI rules, wrappers, page patterns, state/HTTP/tenancy, and the design workflow — is in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Highlights:

- **Routing** — lazy routes guarded by purpose: `noAuthGuard` (public), `authGuard` (shell), `adminGuard()` (catalog/admin), `roleGuard(['Owner'])` (trainer screens). UI guards are defense-in-depth; the API is the real authorization boundary.
- **Authentication** — the access token lives in an in-memory signal (never `localStorage`); on load, a silent refresh against the httpOnly `gymbro_refresh` cookie restores the session, and a 401 interceptor refreshes-and-replays once.
- **State** — service signals are the single source of truth; per-feature services reset on tenant switch so there's no cross-workspace bleed.
- **API integration** — all calls hit the relative `/api`; `authInterceptor` attaches `Authorization` + `X-Tenant-Id` automatically. No `environment*.ts` (the API version is header-negotiated).

## Quick start

**Prerequisites:** Node.js 22+ and a running **GymBro API** (see that repo's quick start).

```bash
npm install
npm start            # ng serve on http://localhost:4200 (proxies /api → the API)
```

Point `proxy.conf.json` at your API's address if it differs from the default. Sign in with an account you register,
or the seeded API admin **`admin@gymbro.local`** / **`Admin@123456`**.

## Environment configuration

There are **no `environment*.ts` files** — the API base is always the relative `/api`. How it reaches the backend
differs per environment:

- **Dev** — `proxy.conf.json` proxies `/api` → the local API (`ng serve` uses it automatically).
- **Prod** — the nginx container (`nginx.conf`) serves the built SPA and reverse-proxies `/api` → the API, so the browser sees one origin (no CORS).

## Testing

```bash
npm test                                                  # Karma + Jasmine
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox   # headless / CI
```

Where Chrome can't be captured, verify with `npm run build` + `npx tsc -p tsconfig.spec.json`.

## Build & deploy

```bash
npm run build                       # static assets → dist/gym-bro-portal/browser
docker build -t gymbro-portal .     # nginx image serving the SPA + reverse-proxying /api
```

CI builds, runs the API-contract drift check, and runs tests on every push/PR; CD builds the nginx image, pushes
it to GHCR, and deploys on merge to `main`.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — structure, UI rules, wrappers, state/HTTP/tenancy, routing, design workflow.
- Contributor and AI-agent conventions: **[CLAUDE.md](CLAUDE.md)**.
- API contracts, permissions, and business rules live in the **GymBro API** repository.
