# UI screen patterns (canonical)

**Purpose:** Any **new route-level screen** in GymBroPortal should match these conventions so buttons, forms, spacing, and chrome stay consistent with existing work—especially **`features/exercises/`** (list + editor).

**Reference implementations**

| Pattern | Primary reference |
|--------|-------------------|
| List + table + row actions | `src/app/features/exercises/exercise-list/` |
| Multi-section form + sticky footer | `src/app/features/exercises/exercise-form/` |
| Plan metadata (create / edit header) | `src/app/features/workspace/plans/plan-details-form-dialog/` — opened from `plans-list/plans-list.ts` (Create) and `plan-builder/plan-builder.ts` (pencil) |
| Builder + structure save | `src/app/features/workspace/plans/plan-builder/` (sticky footer) |
| Empty state inside a flow | `src/app/features/workspace/clients/clients.html` (empty block) |

---

## 1. List screens (catalog / admin tables)

1. Wrap in `<section role="region" …>` when it helps accessibility.
2. **`app-ui-page-container`** with **`class="flex flex-col gap-inv-5"`** (same as exercise list).
3. **`app-page-header`**: `title`, `subtitle`, optional **`div.ui-page-actions`** for primary list actions (`Create …` → `app-button` with `icon="pi pi-plus"`).
4. Prefer **`app-data-table`** with declarative **`tableColumns`**, **`[loading]`**, **`emptyMessage`**, **`loadingMessage`**, **`globalSearchPlaceholder`**, **`itemLabel`**. In **`appDataTableCell="actions"`**, row actions must use icon-only **`app-button`** (`pi pi-pencil` for edit, `pi pi-trash` for delete), `size="small"`, `[text]="true"`, `[rounded]="true"`, and descriptive `[ariaLabel]`; use `severity="secondary"` for edit and `"danger"` for delete—mirror **exercise-list** cells.
5. Do **not** hand-roll a second table/filter pattern in the feature; extend **`shared/ui/data-table`** if something is missing.

---

## 2. Full-page editors (create / edit / builder)

### Page shell

1. Outer **`<section>`** with the same vertical rhythm as exercise form:

   `class="flex min-h-[calc(100dvh-6rem)] min-w-0 flex-col pb-24 md:min-h-[calc(100dvh-6.5rem)] md:pb-[5.5rem]"`

   The **`pb-24` / `md:pb-[5.5rem]`** leaves room for the **sticky footer** so the last card is not hidden.

2. **`app-ui-page-container`** with **`class="flex w-full min-w-0 flex-1 flex-col gap-inv-5"`** (or `gap-6` if the screen is not yet migrated—prefer **`gap-inv-5`** for new work).

3. **`app-page-header`**: title + subtitle. Put **primary navigation out of the header** if the same actions appear in the **sticky footer** (avoid duplicate Back/Cancel).

### Form body

1. **`ReactiveFormsModule`** + **`FormBuilder` / `NonNullableFormBuilder`**. No template-driven forms.
2. Group content in **`app-ui-panel-card`** with **`header`** and optional **`subheader`** (short, factual). Match **exercise-form** “Basics” / “Classification” style.
3. Inside each card: **`div.flex.min-w-0.flex-col.gap-4`** wrapping fields.
4. Fields: **`app-form-field`** + **`app-input`** (or **`app-select`** for string option lists). **`[required]="true"`** on the field when the control is required; show **`[errorMessage]`** from TS validators.
5. **Two-column metrics / enum rows:** **`app-ui-form-grid`** (not ad-hoc `grid grid-cols-2` unless you have a documented exception).

### Sticky actions (required for save flows)

1. After **`</app-ui-page-container>`**, sibling **`app-ui-page-sticky-footer`** (see **exercise-form** footer).
2. Footer layout: **left** = short status / hint (`text-inv-body-sm` / `text-inv-grey-500`–`600`, optional **`max-w-md`**). **Right** = **`div.flex.shrink-0.items-center.justify-end.gap-3`**.
3. **Cancel / Back:** **`app-button`** `severity="secondary"` **`[outlined]="true"`** `type="button"` **`(clicked)="…"`**.
4. **Save / primary:** **`app-button`** `severity="primary"` **`icon="pi pi-check"`** (or domain-appropriate icon), **`[loading]`**, **`[disabled]`** when in flight, **`type="button"`** calling the submit handler (do not rely on **`form`** attribute across **`app-button`** unless verified—**exercise-form** uses **`(clicked)="requestFormSubmit()"`**).
5. Optional: **unsaved changes** row on the left (dot + copy) like **exercise-form** when the feature tracks dirty state.

---

## 3. Mandatory shared components (do not bypass in features)

Use wrappers from **`src/app/shared/ui/`** (see barrel **`index.ts`**):

| Role | Component |
|------|-----------|
| Actions | `app-button` — **no raw `p-button`** in feature templates |
| Text / textarea | `app-input` (exception: inside **`p-iconfield`**, use **`pInputText`** per rule) |
| Simple string enum | `app-select` (PrimeNG **`p-select`** under the hood) |
| Field chrome | `app-form-field` |
| Page chrome | `app-page-header`, `app-ui-page-container`, `app-ui-page-sticky-footer` |
| Section cards | `app-ui-panel-card` |
| 2-col field rows | `app-ui-form-grid` |
| Inline field + button row | `app-ui-form-inline` |
| Tables | `app-data-table` + **`appDataTableCell`** |

---

## 4. Select / dropdown exception (object options)

**`app-select`** only supports **`string[]`** options. For **id + label** catalogs (e.g. exercise picker), **`features/exercises/exercise-form`** is not the reference—use **`plan-builder`** style: **`p-select`** from **`primeng/select`** with **`optionLabel` / `optionValue`**, **`[filter]="true"`**, **`appendTo="body"`**, **`styleClass="w-full min-w-0"`**, still wrapped in **`app-form-field`**. Do **not** use legacy **`p-dropdown`**.

---

## 5. Styling tokens

- **Colors / type:** Tailwind **`inv-*`** utilities or **`var(--inv-*)`** — **no hex** in feature code.
- **Primary actions:** blue semantic primary (`severity="primary"` on **`app-button`**).
- **Inside cards:** prefer design tokens over one-off grays; nested bordered blocks may use **`border-inv-grey-200`**, **`bg-inv-grey-0`** aligned with existing screens.

---

## 6. When you add a new screen

1. Pick the closest reference (**list** vs **editor**) from **`features/exercises/`**.
2. Copy the **outer section + container + footer** structure before inventing a new layout.
3. Reuse the same **button severities**, **footer gap classes**, and **panel + form-field** stacking.
4. Update **`docs/claude-context-short.md`** or this file only if you introduce a **new** justified pattern (then document it here for the next feature).

---

## 7. Doc cross-references

- Short stack reminder: **`docs/claude-context-short.md`**
- Token / Figma alignment: **`docs/design-system.md`**, **`.cursor/rules/figma-design-system.mdc`**
- Cursor always-on Angular rules: **`.cursor/rules/angular-frontend.mdc`**
