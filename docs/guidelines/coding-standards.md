# Coding standards

Opinionated, measurable rules for Irecon Insurance. Prefer tooling (TypeScript strict, ESLint, Prettier, `npm run verify`, CI) for what machines can enforce; this doc covers the rest.

Companions: [design-patterns.md](design-patterns.md) · [performance.md](../architecture/performance.md) · [ui-guidelines.md](ui-guidelines.md) · [code-review.md](code-review.md)

## Clean code

- One responsibility per module.
- Small, focused functions.
- Prefer pure functions.
- Minimize shared mutable state.
- Minimize dependencies.
- Prefer explicit code over magic.
- Delete dead code; no commented-out blocks; no stray `console.log` in committed code.
- Prefer readability over cleverness.
- Avoid deep nesting; return early.
- Prefer deleting code over new abstractions.

## Complexity limits

Extract when exceeded.

| Limit           | Max                                  |
| --------------- | ------------------------------------ |
| Function body   | 50 lines                             |
| React component | 300 lines                            |
| File            | 500 lines                            |
| Nesting depth   | 3 levels                             |
| Parameters      | 4 (use an options object after that) |

Existing hotspots above these limits are debt — do not grow them; split on touch when practical.

## Imports

**Order (blank line between groups):**

1. `react`
2. `react-router` / `@react-router/*`
3. Third-party packages
4. `~/` aliases
5. Relative imports
6. CSS / side-effect imports last

**Never:**

- Circular imports
- Barrel files that hide real dependencies (`index.ts` re-export soup)
- Deep relatives (`../../../../`) — use `~/` instead

## TypeScript

- `"strict": true`. No new `any`. Boundaries: `unknown` + narrow.
- Prefer `type` over `interface`. Use `interface` only for declaration merging or public extension.
- Prefer `readonly`, `ReadonlyArray<T>`, `as const`, `satisfies`.
- Prefer `import type` for type-only imports.
- Named exports everywhere; default export only for route modules.
- **Never** use: `enum`, `namespace`, or wrappers `Object` / `Function` / `Boolean` / `Number` / `String` as types.
- **No type assertions** (`foo as Bar`) unless unavoidable. Prefer Zod parse, type guards, or narrowing.
- Avoid non-null assertions (`!`) unless the invariant is local and obvious.

## React

- Function components only.
- Never mutate props or state — update immutably.
- Never derive state with `useEffect`. Avoid duplicated state; compute during render or lift to the loader.
- Prefer `loader` / `action` / `useFetcher` / `useNavigation` over client fetching.
- **Never** `useEffect(() => { fetch(...) }, [])` when a loader/action fits.
- Do not add `useMemo` / `useCallback` by default — only for proven hot paths.
- List keys: stable ids, never index for dynamic/reorderable lists.
- Forms: RHF + Zod + Field helpers ([ui-guidelines.md](ui-guidelines.md)).

## React Router

- Loaders are **deterministic reads**. They must not: mutate DB, send email, write R2, or trigger side effects.
- **Actions own mutations.**
- Resource routes (`api/*`): **JSON only**.
- Page routes: **UI only** (plus loader DTOs).
- Authz (`requireAuth` + the documented product scope and roles) on every loader/action/`api/*`.
- Validate with Zod at the edge (draft vs full schema).
- Multi-intent: `formData.get("intent")`.
- Use `./+types/<route>` generated types.
- Keep `shouldRevalidate` intentional (draft saves must not thrash the shell).
- Public URLs live in `app/routes.ts` — folder moves must not change path strings.

## Services

- Framework-agnostic: **must not** import `react`, `react-router`, fetchers, or hooks.
- Own business rules, transactions, and orchestration.
- Testable without a browser.
- Prefer `*.server.ts` for server-only services when splitting domains.

## Database

```text
DB → repository/query → domain (service) → DTO (mapper) → UI
```

- Never return raw DB rows to loaders/UI — always map.
- Avoid `return db.select()…` straight into `loader` data without a mapper/DTO.
- Runtime data from Postgres. Seeds/fixtures only under `_archive/data/` or scripts — not new request-path business JSON.
- Forward-only migrations; expand/contract for breaking changes.
- Multi-table writes in a transaction.
- Parameterized SQL / Drizzle only — never string-built SQL with user input.
- Soft-delete only if product requires it; else hard delete + audit.

## Error handling

Prefer typed domain errors over `throw new Error("…")`:

| Class                  | Use                                   |
| ---------------------- | ------------------------------------- |
| `ValidationError`      | Bad input (after Zod or domain rules) |
| `AuthorizationError`   | Authenticated but not allowed         |
| `NotFoundError`        | Missing entity                        |
| `ConflictError`        | Version / unique / state conflict     |
| `ExternalServiceError` | Supabase, R2, email, etc.             |

Routes map these to `formError`, field errors, toast, or HTTP status. API shape: `{ ok, errors?, formError? }`. Unexpected → route `ErrorBoundary` / `AppErrorPage`.

Use the shared domain error classes in `app/lib/errors.ts` for expected failures; do not proliferate raw `Error` throw sites.

## Logging

**Never log:** passwords, tokens, cookies, JWTs, API keys, or PII (names, emails, addresses, policy content beyond ids).

**Always include when structured logging exists:** `requestId`, `userId`, `route`, `duration`.

No `console.log` in committed app code; use [`app/lib/observability/logger.server.ts`](../app/lib/observability/logger.server.ts) (`logger.info` / `logger.error`, …). See [observability.md](observability.md).

## Security

- Validate every input. Never trust the client.
- Enforce the documented product scope, not UI visibility alone. Currently, authenticated enabled brokers have portfolio-wide client/policy access; settings mutations, including users and authorised representatives, require admin or super-admin.
- Authz on every server entry — UI hiding is not security.
- Escape / encode output appropriately (React text nodes are safe; don’t `dangerouslySetInnerHTML` with untrusted data).
- CSRF: follow React Router same-origin action + cookie practices (`httpOnly` / `secure` / `sameSite`).
- Rate-limit public endpoints (auth, email) when infrastructure allows.
- R2/signed URLs short-lived; no public customer-doc buckets.
- Secrets never in git. Staging must not email real insurers without a kill switch/sink.

## Naming

| Area       | Convention                                                       |
| ---------- | ---------------------------------------------------------------- |
| Routes     | `clients.$clientId.edit.tsx`, `api.policies.$policyId.draft.tsx` |
| URLs       | kebab-case                                                       |
| Components | `client-form.tsx` → `ClientForm`                                 |
| Services   | `policy.service.ts`                                              |
| Zod        | `lib/zod/client.ts`                                              |
| DB         | camelCase TS ↔ snake_case SQL                                    |
| Types      | PascalCase DTOs                                                  |
| Intents    | `draft`, `save`, `delete`                                        |

Product copy: **Irecon Insurance** (`APP_NAME` / `pageTitle()` in `app/lib/brand.ts`).

## Documentation

Document non-obvious public APIs (idempotency, audit side effects, auth assumptions):

```ts
/**
 * Creates a draft policy.
 * Idempotent for the same broker + client intent.
 * Writes an audit log row.
 */
```

Do not document obvious code.

## Testing

**Required today:** `npm run typecheck`.

**Target:** Vitest (Zod, pricing, services) + Playwright (critical journeys). Prefer `getByRole` / labels. Pricing changes need golden fixtures. Never use prod credentials in tests.

## Git

Prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`. One concern per PR. No force-push to `main`.
