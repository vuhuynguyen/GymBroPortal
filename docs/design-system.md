# GymBro UI System

Human- and AI-readable contract for **GymBroPortal** (Angular admin). For Figma handoff steps, see `docs/figma-workflow.md`. Cursor rules: `.cursor/rules/design-system-enforcer.mdc`, `.cursor/rules/ui-consistency.mdc`.

---

## Extracted from Figma Make: Edit Exercise Page

**Source export (reference only, not production code):**  
`docs/_figma-edit-exercise/Edit Exercise Page Design/` — primary screen composition lives in `src/app/App.tsx`.

The export is **React + Tailwind** for visualization. When implementing in Angular, map patterns below to **`src/app/shared/ui/`**, PrimeNG, and **`inv-*` / `--inv-*` tokens** (do not copy purple accents as brand primary; see note under Preview tags).

### Layout system

| Region | Behavior |
|--------|----------|
| **App frame** | Full viewport height; horizontal **flex**: fixed **sidebar** + scrolling **main**. Page background is a light neutral (export: gray-50). |
| **Sidebar** | Fixed width **256px** (`w-64`); white surface; **right border**; column flex. **Top:** brand block (logo square + title + subtitle) with **bottom border**. **Middle:** nav section with small **uppercase section label**, then **full-width nav row** (icon + label). **Bottom:** **pinned footer** (`mt-auto`) with user avatar row and **top border**. |
| **Main column** | Fills remaining width; **vertical scroll** (`overflow-auto`). |
| **Top chrome** | White bar, **bottom border**; inner **max-width ~1280px** centered (`max-w-7xl`), **horizontal padding** (`px-8`), **vertical padding** (`py-4`). **Left:** back control + **breadcrumb** (muted segments, current page **emphasized**). **Right:** optional **icon-only** settings control. |
| **Page body** | Same **max-width centered** + `px-8 py-8` as header row for alignment. |
| **Page intro** | **Below chrome, above grid:** page **title** (large, semibold) + **one line of supporting copy** (muted); **margin below** before main grid (export: `mb-8`). |
| **Primary grid** | **Responsive:** single column on small screens; from **large breakpoint** → **3-column grid** with **two columns for form** and **one for preview** (ratio **2 : 1**). **Column gap** is large (export: `gap-8`). |
| **Form stack** | In the wide **2/3** column, **multiple section cards** stacked with **consistent vertical gap** (export: `space-y-6`). |
| **Preview column** | In the **1/3** column, preview card **sticks** while scrolling (export: `sticky` with `top-8` offset). |
| **Bottom action region** | **Fixed** bar spanning main content only (export offsets left by sidebar width): **top border**, light **upward shadow**, white background. Inner row matches **max-width + horizontal padding** of header. **Left:** small **status dot** + short status text. **Right:** **secondary** action + **primary** action (primary includes **leading icon**). **Spacer** above bar inside scroll area so last card is not hidden (export: fixed height ~ `h-24`). |

### Spacing scale (from export Tailwind usage)

Values below are **from the Figma Make export**; align to the portal’s **8px rhythm** when mapping (`gap-2` = 8px, `gap-4` = 16px, `gap-6` = 24px, `gap-8` = 32px).

| Token / pattern | Typical use in export |
|-----------------|------------------------|
| **`px-8` / `py-4`** | Header bar and bottom bar horizontal padding; vertical padding in those bars. |
| **`py-8`** | Main page content vertical padding. |
| **`p-6`** | Sidebar brand header; **card outer padding** on form sections. |
| **`p-4`** | Sidebar nav block; preview card header and body padding. |
| **`mb-8`** | Space after page title block before the 2+1 grid. |
| **`gap-8`** | Between form column and preview column (grid gap). |
| **`space-y-6`** | Between stacked form section cards. |
| **`mb-5`** | Between card **title block** (heading + description) and first field group. |
| **`space-y-4` / `gap-4`** | Between fields inside a card; **2×2 field grid** gutter. |
| **`mb-2`** | Between **label** and **control**. |
| **`gap-3`** | Brand row icon + text; bottom bar button group; status row. |
| **`gap-2`** | Chip wrap spacing; add-muscle row (select + button). |
| **`py-2.5` + `px-4`** | Default control vertical + horizontal padding in inputs/selects. |
| **`px-5` + `py-2.5`** | Primary/secondary actions in bottom bar. |
| **`top-8`** | Sticky preview offset from viewport top. |

**Radius:** cards and controls use **large rounded corners** (export: `rounded-xl` on section cards, `rounded-lg` on controls and chips).

### Component patterns

| Pattern | Description |
|---------|-------------|
| **Brand / app identity** | Square **logo mark** + app name + environment/subtitle in sidebar header. |
| **Nav section label** | Small, **uppercase**, wide **letter-spacing**, muted—then nav entries below. |
| **Active nav item** | Full-width row; **muted background** + dark text (single active in export). |
| **User block** | Circle **avatar** + name + role line; `min-w-0` / truncate-friendly row. |
| **Breadcrumb** | Inline path with separators; final segment is **current** (darker + medium weight). |
| **Page header** | **H1** + short **subtitle** (muted); no duplicate chrome inside cards for page title. |
| **Section card** | White panel, **border**, **xl radius**. **Title** (`text-lg` semibold) + **helper line** (small, muted, `mt-1`). Body uses vertical field rhythm or internal **2-column grid** where fields are paired (classification, numeric pair). |
| **Field row** | **Label** (small, medium weight, gray) + optional **required** red asterisk; **full-width** text, textarea, or select; placeholders for hints. **Textarea** fixed rows with **no resize** in export. |
| **Removable value chips** | Horizontal wrap; chip = **light tinted background** + **colored text** + **small dismiss** control; optional **margin below** before add row. |
| **Add row** | **Flex:** flex-grow select + **adjacent** “Add” control (muted background button, **icon + label**, disabled when empty). |
| **Preview card** | Nested: **header strip** (title “Live Preview” + subtitle) with **bottom border**; body contains **inner bordered** preview frame. |
| **Preview media** | Fixed **aspect height** image (`h-48`), **object-cover**; **empty state**: neutral fill, **large icon**, short caption (“No image”). |
| **Preview tags** | Small **pill tags** for type / movement / difficulty with **distinct pastel backgrounds** (export uses **blue** / **purple** / **green**). **GymBroPortal mapping:** keep **semantic emphasis** but use **token-driven** colors; **do not** adopt purple as primary brand (use neutral + primary scale per `figma-design-system` rule). |
| **Preview copy** | Title + **clamped** description (3 lines max in export) + **key/value rows** (fixed label column width ~80px, values for equipment, muscles, optional secondary list, calories, duration). |
| **Bottom bar actions** | **Cancel** = outline / gray border. **Save** = **solid blue** + **check** icon—single primary. |

---

## Portal defaults (Angular)

Use this section when **not** tied to a specific Figma frame, or after remapping export patterns to the app shell.

### Layout

- **Centered container** in the main shell; content not edge-to-edge on large screens.
- **Max width** — follow **`app-shell`** / existing admin content width; Figma export used **~1280px** (`max-w-7xl`); earlier portal doc used **~1200px**—treat as **same intent** (constrained readable width).
- **Two-column editor layout:** **left** reactive form (`app-form-field` + controls); **right** **preview** (image + meta), sticky where the shell allows.

### Spacing (portal rhythm)

- **Between major vertical blocks:** `gap-6` / `space-y-6`.
- **Card padding:** prefer shared **`app-ui-panel-card`** defaults; export used **`p-6`** on section cards and **`p-4`** on preview sub-panels—**map to one shared card padding** for consistency.
- **Within card field groups:** `gap-4` / `space-y-4`.

### Components (implementation targets)

- **Form field** — `app-form-field`; `app-input`, `app-select`; validators and errors in TS.
- **Card** — `app-ui-panel-card` (or equivalent shared panel).
- **Button** — `app-button`: primary vs secondary/destructive as needed.
- **Preview** — shared preview pattern; chips/tags via shared chip or tag patterns.
- **Page chrome** — `app-page-header`, shell breadcrumbs/back as already provided by the app.

### Rules

- **Reuse** `src/app/shared/ui/`; extend `index.ts` when a pattern appears twice.
- **No per-screen** one-off styling; **no inline styles** for colors/layout hacks.
- **Empty / optional values:** “Not set” or hide—see `ui-consistency.mdc` (avoid raw `-` / `undefined`).
