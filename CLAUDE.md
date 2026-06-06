# GymBro Portal — Angular UI

Project guide (single necessary frontend doc): [`docs/FRONTEND.md`](docs/FRONTEND.md)
System single source of truth: [`../docs/README.md`](../docs/README.md) · Repo conventions: [`../CLAUDE.md`](../CLAUDE.md)

---

Angular 21 · standalone · OnPush · signals · PrimeNG 21 · Tailwind + `inv-*` tokens.

## Read before any task

| Task | Read |
|---|---|
| Any UI work (structure, rules, patterns, tokens, Figma) | [`docs/FRONTEND.md`](docs/FRONTEND.md) |
| API calls / endpoints | [`../docs/MODULES.md`](../docs/MODULES.md) |
| Permissions / who-can-do-what | [`../docs/PERMISSIONS.md`](../docs/PERMISSIONS.md) |
| Flows (onboarding, plans, sessions) | [`../docs/USER_FLOWS.md`](../docs/USER_FLOWS.md) |

## Non-negotiables (full detail in `docs/FRONTEND.md`)

- **`inv-*` tokens only** (no hex); **no raw PrimeNG** (use `src/app/shared/ui/` wrappers); **reactive forms only**.
- **Signals + OnPush + standalone**; all state in service signals.
- App structure is `src/app/{core,features,shared}` only — don't add new top-level folders.
- `authInterceptor` adds `Authorization` + `X-Tenant-Id`; permission enforcement is server-only — the frontend has no permission mirror to keep in sync.
- Filenames per Angular v20+ style guide (`login.ts`, `auth.ts`, `auth-guard.ts`; class names keep their suffix).

## Update rule

When you change UI structure/rules/patterns, update **`docs/FRONTEND.md`** (the one frontend doc). For system
behavior (endpoints, permissions, flows, data) update the owning file under [`../docs/`](../docs/) — do not duplicate.
