# GymBro Portal — Angular UI

Root project docs: `../CLAUDE.md`  
AI rules: `../docs/ai-rules.md`

---

## This project

Angular 21 · Standalone components · OnPush · PrimeNG 21 · Tailwind + `inv-*` tokens

## App structure (three buckets only)

```
src/app/
├── core/        # singletons: auth/, config/, feature-flags/, layout/, tenant/
├── features/    # route-level: admin/, auth/ (pages), dashboard/, exercises/, settings/, workspace/
└── shared/ui/   # dumb, stateless wrappers
```

**Layout shell side panels** (`core/layout/`): `InviteGymBroPanelComponent` + `InviteGymBroPanelService` (`invite-gymbro-panel/`) for coach invite codes; `JoinGymBroPanelComponent` (`join-gymbro-panel/`) for entering a code to join another workspace. Wired from `app-shell` Team nav and from `ClientsComponent` via the service.

**Filename rules** (Angular v20+ style guide, file-only — class names keep suffix):
- Components / services drop suffix: `login.ts`, `auth.ts`, `exercise-list.ts`
- Guards / interceptors / directives / pipes hyphenate: `auth-guard.ts`, `auth-interceptor.ts`
- Models / routes / configs keep suffix: `exercise.model.ts`, `exercises.routes.ts`, `prime-ng.config.ts`
- Auth **pages** live in `features/auth/`; auth **infra** (guards, interceptor, service) lives in `core/auth/`
- Do **not** add new root-level folders at `src/app/` — fit into `core/`, `features/`, or `shared/ui/`

---

## Read before any task

| Task | Read |
|---|---|
| Any UI work | `docs/claude-context-short.md` |
| New page / component | `docs/claude-context-short.md` → **`docs/ui-screen-patterns.md`** (list + editor + sticky footer) |
| API calls | `../docs/api-contracts.md` |
| Figma Make export | `docs/figma-workflow.md` (full) or `../docs/figma-to-angular.md` (summary) |
| Design tokens / spacing | `docs/design-system.md` |
| Figma export folder | `docs/_figma-*/` |

---

## Hard rules

- **Docs stay in sync** — In the same change as the code, update docs when you touch routes, shell/sidebar (sections, labels, entry points), renamed or moved `core/layout` components, workspace UX, or cross-cutting patterns. At minimum: this file (`CLAUDE.md`) and `docs/claude-context-short.md`; also `docs/claude-context.md` if engineering rules or architecture bullets change. Do not leave stale paths, selectors, or type names in docs.
- **No hex colors** in feature code — `inv-*` tokens only
- **No raw PrimeNG** (`p-button`, `p-dropdown`) — always use `src/app/shared/ui/` wrappers
- **No template-driven forms** — `FormBuilder` + `FormGroup` only
- **Blue primary** — no purple as brand color
- **Signals + OnPush** — no `BehaviorSubject` + `async` pipe for new code
- **Standalone only** — no NgModule declarations

---

## Shared UI (mandatory wrappers)

`src/app/shared/ui/` — always check here before writing a new component:

`app-button`, `app-input`, `app-select`, `app-form-field`,  
`app-page-header`, `app-ui-page-container`, `app-ui-panel-card`,  
`app-data-table` + `appDataTableCell`, `app-filter-bar`,  
`app-chip-removable-list`, `app-ui-form-grid`, `app-ui-form-inline`,  
`app-confirm-split-dialog`, `app-success-dialog`, `app-info-dialog`

---

## Page component pattern

```typescript
@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [...] })
export class MyPageComponent implements OnInit {
  private readonly service = inject(MyService);
  readonly data = this.service.data;       // signal
  readonly loading = this.service.loading; // signal
  ngOnInit() { this.service.load(); }
}
```

**List page (table):** mirror **`features/exercises/exercise-list`**.

```html
<app-ui-page-container class="flex flex-col gap-inv-5">
  <app-page-header title="..." subtitle="...">
    <div class="ui-page-actions"><app-button .../></div>
  </app-page-header>
  <app-data-table ... />
</app-ui-page-container>
```

**Full-page editor (save / cancel):** mirror **`features/exercises/exercise-form`** — outer `<section>` with bottom padding for the bar, `app-ui-page-container`, stacked **`app-ui-panel-card`** sections, then **`app-ui-page-sticky-footer`** with **outlined secondary** cancel/back and **primary** save (`pi-check`). Details and exceptions: **`docs/ui-screen-patterns.md`**.

---

## Figma Make workflow (critical)

Figma Make exports **React + Tailwind**. We are Angular. Steps:

1. Read `docs/figma-workflow.md` (or summary in `../docs/figma-to-angular.md`)
2. Extract **visual intent** from `App.tsx` — layout, spacing, section order
3. Map to `shared/ui/` components + `inv-*` tokens
4. Build with Angular patterns (reactive forms, signals, standalone)
5. After adding new Tailwind responsive classes: `rm -rf .angular/cache && ng serve`
