# GymBro Frontend — Claude context (short)

**Stack:** Angular (standalone, OnPush), PrimeNG 21+, Tailwind (`inv-*` tokens only).

**Core:** Reuse shared UI; no duplicated filters/tables/forms; production-ready TS; services for APIs (never templates).

**Angular:** Standalone only; `inject()`; signals where helpful; **no template-driven forms**.

**Forms:** Reactive only, `FormBuilder`, strong typing; validators and rules in TS; clear errors in UI.

**Mandatory shared UI:** `app-button`, `app-input` (except `p-iconfield` → `pInputText`), `app-select` for string lists (`p-select` only—**never `p-dropdown`**), `app-form-field`, `app-page-header`, `app-ui-page-container`, `app-ui-page-sticky-footer`, `app-filter-bar`, `app-data-table`, `app-ui-panel-card`, `app-ui-form-grid`. Object option lists: **`p-select`** inside `app-form-field` per **`docs/ui-screen-patterns.md`**. Fix styling in shared components.

**Styling:** Tailwind for layout/spacing/responsive; **blue primary**—**no purple**; no hex in features; no inline colors; token alignment across CSS variables, PrimeNG preset, and Tailwind. Chips/badges must follow system chip standards (`inv-catalog-chip` + `--inv-catalog-chip-radius`), not pill (`999px`) radius.

**Layout:** flex + gap; **`gap-inv-5`** on page containers for new list pages (see **`features/exercises/exercise-list`**); **`gap-4`** inside panel bodies; responsive everywhere; `min-w-0` for truncating flex children; tables scroll/stack on small screens. In `app-data-table` action cells, row action buttons should use icon-only `app-button` (`pi-pencil`/`pi-trash`), `size="small"`, `[rounded]="true"`, `[text]="true"`, and descriptive `[ariaLabel]`. **New list/editor screens:** follow **`docs/ui-screen-patterns.md`** (sticky footer for save flows matches **`exercise-form`**).

**PrimeNG:** `p-table` via `app-data-table`; `p-select` not `p-dropdown`; configure themes, don’t hack overrides.

**Architecture:** `src/app/core/` (auth, tenant, layout, config, feature-flags — singletons) + `src/app/features/<feature>/` (route-level work) + `src/app/shared/ui/` (dumb wrappers). Shell overlays: `invite-gymbro-panel` (service opens from Team / clients), `join-gymbro-panel` (Join GymBro from Team). Auth pages live in `features/auth/`; auth infra in `core/auth/`. Filenames follow Angular v20+ style guide: components/services drop suffix (`login.ts`, `auth.ts`), guards/interceptors/directives/pipes hyphenate (`auth-guard.ts`, `auth-interceptor.ts`); class names keep suffix.

**Performance:** lazy routes; `@defer` / dynamic import for heavy UI; skeletons; OnPush + signals; paginate or virtualize big lists.

**Never:** template-driven forms, raw `p-button`/`p-dropdown` in features, duplicated UI, monolithic components, inline styles, single-breakpoint layouts, blocking main thread on navigation.

**Docs:** If you change routes, shell nav, layout panel names/paths, or workspace flows, update `CLAUDE.md`, this file, and `docs/claude-context.md` (when rules/architecture change) in the same pass—no stale file paths or component names.
