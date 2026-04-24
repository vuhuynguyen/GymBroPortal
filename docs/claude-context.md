# GymBro Frontend Engineering Rules

## Tech stack

- **Angular** — latest; **standalone components only** (no NgModules).
- **PrimeNG** — v21+ UI components; configure via theme preset, not ad-hoc overrides.
- **TailwindCSS** — layout, spacing, breakpoints, responsive behavior; `inv-*` token utilities for color and typography.

---

## Core principles

- Reuse **shared UI** for interactive and structural patterns; fix styling in shared components, not on feature pages.
- **No duplication** of filters, tables, form chrome, or one-off design variants—extend shared pieces.
- **Clean architecture**: UI vs state/logic vs models; services own API access; templates do not call APIs.
- **Production-ready only**: strict TypeScript, typed APIs, readable naming, no dead code or `console.log`.
- **Smart vs dumb**: containers handle API and state; presentational components take clear `@Input` / `@Output`; avoid tight coupling.
- Match **existing feature layout** when adding work; do not introduce a second folder pattern.

---

## Angular rules

- Standalone components only; no NgModules.
- **`ChangeDetectionStrategy.OnPush`** by default.
- Prefer **`inject()`** over constructor injection when suitable.
- Use **signals** (and `computed`) for state and derived values where they reduce churn and clarify data flow.
- Avoid unnecessary RxJS; no deprecated Angular APIs.
- **No template-driven forms.**

---

## Forms rules

- **Reactive Forms only**; use **`FormBuilder`**.
- Strongly type form models and controls.
- **Validators and validation logic live in TypeScript** (component or helpers), not in template `*ngIf` spaghetti.
- Show field errors clearly in the UI; keep form structure **consistent** across the app.

---

## UI system rules

Mandatory reuse from the shared UI barrel—**do not use raw PrimeNG actions or fields in feature templates** except where explicitly noted.

| Use | For |
|-----|-----|
| **`app-button`** | All actions (wraps `p-button`; no raw `p-button` in features). |
| **`app-input`** | Text fields in forms. **Exception:** inside `p-iconfield`, use native `pInputText` as required by PrimeNG. |
| **`app-select`** | Dropdowns — **`p-select` only**; never **`p-dropdown`**. |
| **`app-form-field`** | Label, errors, and projected control chrome. |
| **`app-page-header`** | Page title and actions area. |
| **`app-filter-bar`** | List / screen filter rows. |
| **`app-data-table`** | Tables, search, column filters, pagination (wraps `p-table`). |
| **`app-ui-panel-card`** | Panel / card shells. |

**List screens:** compose filter bar + data table through these shared building blocks; **extend** them when behavior diverges instead of copying markup per page.

**Styling drift:** change **shared UI**, not individual feature pages.

If a **new UI pattern** appears twice, **extract** to shared UI before shipping.

---

## Styling rules

- **Tailwind** for layout (flex, grid), spacing (`gap`, `p`, `m`), visibility, and breakpoints (`sm:`, `md:`, `lg:`).
- **Colors and type:** only **`inv-*` utilities** and **`var(--inv-*)`** — e.g. greys, primary blues, semantic success/warning/error, `bg-inv-surface-base`. **No arbitrary hex** in feature templates or one-off SCSS.
- **Primary brand is blue** (`--inv-primary-*`, PrimeNG `semantic.primary`). **Do not use purple** for primary UI, nav brand, or table accents.
- **No inline styles**, except rare non-color dynamic values if truly unavoidable. **No inline color** (no arbitrary hex in templates).
- Avoid large custom SCSS files and unnecessary PrimeNG style overrides; prefer configuration and tokens.
- Keep UI **minimal, clean, consistent**.

**Token layers (keep aligned when the design kit changes):**

- **CSS variables** on `:root` — all `--inv-*`, surfaces, global control/table overrides.
- **PrimeNG preset** — `semantic.primary`, radii, and other primitives consistent with the same blue scale.
- **Tailwind theme** — `inv.*` palette, spacing, radii, typography utilities tied to those variables.

Tokens are **hand-maintained** from design specs—update all three layers together when colors or radii change.

---

## Layout and spacing

- Prefer **flex + gap**; follow an **8px rhythm** (`gap-2` = 8px, `gap-4` = 16px, `gap-6` = 24px).
- **Responsive by default:** every screen and shared component must work from small to large viewports—no horizontal overflow, readable type, tappable targets on touch.
- Use responsive prefixes for layout shifts; use **wrapping** and **`min-w-0`** on flex children that truncate or scroll.
- **Tables / dense data:** horizontal scroll on narrow widths, or stack filters/toolbars vertically; do not assume a fixed desktop width.
- **Shell / nav / drawers:** collapse or adapt on small breakpoints consistently with the rest of the app.
- Prefer **centered container patterns** with sensible **max-width** for primary content; avoid meaningless full-bleed stretching of readable columns on very wide displays.
- Avoid fixed pixel widths that break small screens; sanity-check mobile and desktop.

---

## PrimeNG rules

- **Tables:** `p-table` **through `app-data-table`** in features.
- **Select:** **`p-select` only** (v21+); avoid legacy **`p-dropdown`** except explicit migration.
- **Buttons:** `p-button` **inside `app-button`** in features.
- **Tags:** `p-tag` where appropriate.
- **Inputs:** `pInputText` / `p-inputTextarea` per docs—typically behind `app-input` unless icon field exception applies.
- Prefer PrimeNG over raw HTML **when a component exists**; configure components properly instead of fighting defaults with hacks.

---

## Architecture

- **Features** live under `src/app/<feature>/` (e.g. exercises, dashboard, settings).
- Typical feature shape: route folders (`exercise-list/`, `exercise-form/`), plus `*.service.ts`, `*.model.ts`, `*.routes.ts` at the feature root.
- **Cross-cutting:** `src/app/core/` (shell, app config, PrimeNG preset), `src/app/shared/ui/`, `src/app/shared/utils/`.
- **Separation:** UI components; state and orchestration in containers/services; interfaces and DTO shapes in models.
- **APIs:** only in services—not in templates.

---

## Performance and loading

- **Lazy-load** feature routes to keep the initial bundle small.
- Use **`@defer`** or dynamic `import()` for heavy below-the-fold or optional UI; show placeholders or skeletons while loading.
- Do not block first paint: shell + loading states for async data; **OnPush + signals** to limit change detection.
- Avoid loading large dependencies on every route; split by route or defer.
- **Images:** lazy loading and sensible dimensions; avoid huge unoptimized assets on the critical path.
- **Large lists:** pagination or virtual scrolling when warranted; never render unbounded thousands of rows in the DOM.

---

## Design system and Figma (when implementing UI from design)

- When a Figma file is available, treat **design tokens and specs as source of truth** for color, spacing, type, radii, and components—**do not invent** hex or scales if authoritative values exist.
- Prefer **structured design context** (variables, inspect, or MCP design output) over screenshots alone when both exist.
- MCP or exported snippets that look like **React + Tailwind** are **reference only**—implement with **Angular + PrimeNG + shared UI**, not a literal port.
- If design context is missing, rate-limited, or ambiguous: ask for the correct node selection or pasted variable values, then update tokens manually.
- After token updates, implement with shared components and validate visually against the design.

---

## Page consistency

- Default page skeleton: **`app-page-header`** → **`app-filter-bar`** (when applicable) → content (**`app-data-table`** or reactive form inside **`app-ui-panel-card`** as appropriate).
- Do not redesign spacing, alignment, or component choices per page.

---

## Naming and files

- **kebab-case** filenames: `exercise-list.component.ts`, `exercise.service.ts`, `exercise.model.ts`.
- Methods: verb-led (`getExercises`, `createExercise`). Variables: descriptive, intention-revealing.
- Prefer **constants / enums** over unexplained magic strings or numbers.

---

## Anti-patterns (do not do)

- Template-driven forms.
- Raw **`p-button`** / **`p-dropdown`** in feature code (use shared wrappers and `p-select`).
- Duplicated UI markup, filters, or tables across features.
- Large monolithic components instead of focused, composable pieces.
- Inline styles (especially for color) and hardcoded hex in features.
- Mixing UI frameworks.
- Layouts that only work at one breakpoint or ignore touch targets.
- Blocking initial navigation on optional data or heavy synchronous main-thread work.

---

## Goal

Ship a **maintainable admin dashboard**: consistent **responsive** UI, **fast perceived load** (lazy routes, deferral, lean bundles), strong typing, modern Angular patterns, and a **single design language** enforced through shared UI and tokens.
