# GymBro Portal — Claude Instructions

Start with [`README.md`](README.md). The frontend guide is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — read it
before any UI work.

Angular 21 · standalone · OnPush · signals · PrimeNG 21 · Tailwind + `inv-*` tokens.

## Read before any task

| Task | Read |
|---|---|
| Any UI work (structure, rules, patterns, tokens, design workflow) | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Routing, guards, auth flow, state, HTTP/tenancy | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) + [`README.md`](README.md) |

API contracts, permissions, and business rules are owned by the **GymBro API** repository.

## Non-negotiables (full detail in `docs/ARCHITECTURE.md`)

- **`inv-*` tokens only** (no hex); **no raw PrimeNG** (use `src/app/shared/ui/` wrappers); **reactive forms only** for new code.
- **Signals + OnPush + standalone**; all state in service signals.
- App structure is `src/app/{core,features,shared}` only — don't add new top-level folders.
- `authInterceptor` adds `Authorization` + `X-Tenant-Id`; permission enforcement is server-only — the frontend has no permission mirror to keep in sync.
- Filenames per Angular v20+ style guide (`login.ts`, `auth.ts`, `auth-guard.ts`; class names keep their suffix).

## Update rule

When you change UI structure/rules/patterns, update **`docs/ARCHITECTURE.md`** (the one frontend doc) — do not
duplicate. System behavior (endpoints, permissions, flows) is documented in the API repository.
