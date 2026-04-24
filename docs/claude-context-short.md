# GymBro Frontend — Claude context (short)

**Stack:** Angular (standalone, OnPush), PrimeNG 21+, Tailwind (`inv-*` tokens only).

**Core:** Reuse shared UI; no duplicated filters/tables/forms; production-ready TS; services for APIs (never templates).

**Angular:** Standalone only; `inject()`; signals where helpful; **no template-driven forms**.

**Forms:** Reactive only, `FormBuilder`, strong typing; validators and rules in TS; clear errors in UI.

**Mandatory shared UI:** `app-button`, `app-input` (except `p-iconfield` → `pInputText`), `app-select` (`p-select` only—**never `p-dropdown`**), `app-form-field`, `app-page-header`, `app-filter-bar`, `app-data-table`, `app-ui-panel-card`. Fix styling in shared components.

**Styling:** Tailwind for layout/spacing/responsive; **blue primary**—**no purple**; no hex in features; no inline colors; token alignment across CSS variables, PrimeNG preset, and Tailwind.

**Layout:** flex + gap (`gap-4`/`gap-6`); responsive everywhere; `min-w-0` for truncating flex children; tables scroll/stack on small screens; sensible max-width containers.

**PrimeNG:** `p-table` via `app-data-table`; `p-select` not `p-dropdown`; configure themes, don’t hack overrides.

**Architecture:** `src/app/<feature>/` + `shared/ui` + `core`; separate UI, logic, models.

**Performance:** lazy routes; `@defer` / dynamic import for heavy UI; skeletons; OnPush + signals; paginate or virtualize big lists.

**Never:** template-driven forms, raw `p-button`/`p-dropdown` in features, duplicated UI, monolithic components, inline styles, single-breakpoint layouts, blocking main thread on navigation.
