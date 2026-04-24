---
name: claude-gymbro-ui-design
description: >-
  GymBroPortal UI handoff for Claude (web, Projects, or Claude Code): load design
  docs, treat Figma Make React as design-only, map to Angular + shared/ui and
  tokens. Use when the user works in Claude, pastes Figma Make output, asks for
  UI from a design export, or says “Claude context” / “design system” for this repo.
---

# Claude + GymBroPortal UI / design handoff

## Attach at the start of a conversation (Claude)

Paste or add as project knowledge **in this order** (paths relative to repo root):

1. `docs/design-system.md` — layout, spacing, component vocabulary.
2. `docs/figma-workflow.md` — how to read Figma Make exports (no React port).
3. `docs/claude-context-short.md` — stack, mandatory `shared/ui`, forms, styling guardrails.

Optional for deeper reviews: `docs/claude-context.md` (if present and current).

## Mandatory workflow

### Phase A — Analyze (design only)

Tell the model explicitly:

> Extract the **design system** from this Figma Make / design reference: layout (including 2-column form + preview if applicable), spacing rhythm (`gap-6` / `gap-4` / `p-5`), component types (header, fields, cards, buttons, chips, preview), and visual hierarchy. **Ignore** React/shadcn implementation details.

### Phase B — Apply (Angular)

Then:

> Implement using **Angular** (standalone, OnPush, reactive forms), **PrimeNG**, and **`src/app/shared/ui/`** (`app-button`, `app-form-field`, `app-input`, `app-select`, `app-page-header`, `app-ui-panel-card`, etc.). Use **tokens** only (`var(--inv-*)`, Tailwind `inv-*`). **Do not** transliterate JSX or copy export file structure.

## Rules (non-negotiable)

- **Figma Make React = design reference**, not code to convert line-by-line.
- **Consistency > pixel-perfect**; fix patterns in `shared/ui` / tokens, not per-screen hacks.
- **No** `-` / `undefined` / `null` as user-visible placeholders; use **“Not set”** or hide (see `.cursor/rules/ui-consistency.mdc` in-repo for Cursor; same intent applies in Claude).
- **No** template-driven forms; **no** raw `p-button` / `p-dropdown` in feature templates (use wrappers / `p-select` per `claude-context-short.md`).

## Cursor parity

When the same work happens inside **Cursor**, the repo already loads `.cursor/rules/design-system-enforcer.mdc` (always) and `ui-consistency.mdc` / `figma-design-system.mdc` / `angular-frontend.mdc` as applicable. The Claude skill is the **portable bundle**: attach the three `docs/*` files above so behavior matches.

## Quick copy-paste prompts

**Analyze**

```text
Extract design system from this Figma export (layout, spacing, components, hierarchy only). Do not plan a React-to-Angular conversion.
```

**Apply**

```text
Implement the screen using Angular + shared/ui + design tokens per docs/design-system.md. Reuse preview and form layout patterns from existing exercises admin if relevant.
```
