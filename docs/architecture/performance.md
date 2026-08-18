# Performance

Measure before optimizing. Readability wins over micro-optimizations without evidence ([AGENTS.md](../AGENTS.md) decision rule).

## Database & queries

- **Avoid N+1** — batch or join; don’t query per row in a loop.
- **Paginate** list endpoints and tables (existing list/query-param patterns).
- **Select only needed columns** — no `select *` habit for wide tables.
- **Index** filters you actually use; verify slow paths with `EXPLAIN`.
- **Transactions** for multi-table writes — correct first, then fast.
- Prefer request-scoped `getDb()` / Hyperdrive pooling — don’t open ad-hoc pools per call.
- **Workers query concurrency:** cap at **≤4 parallel** in-flight queries per loader/action (`WORKER_QUERY_GATE_MAX` in `app/lib/db/query-gate.ts`). Each Worker request gets its **own postgres pool** (`WORKER_POOL_MAX = 5`, closed after the request) plus a **per-request query gate** set one below pool max — pools must not be shared across requests (Workers I/O isolation). Use **waves** of `Promise.all`, **combined SQL** (`count(*) FILTER (WHERE …)` for badge counts), and **one query for feature flags** (`getFeatureFlagStates()`). See `app/lib/services/price/snapshot.ts` and `app/lib/services/policies/list.service.ts`.

## HTTP & payloads

- Resource routes: keep JSON small; return DTOs, not graphs of raw rows.
- Stream or chunk large downloads (PDFs, exports) when size warrants it.
- Prefer signed R2 links over embedding large binaries in responses.
- Cache only with a clear invalidation story — don’t invent caches casually.

## React rendering

- Prefer loaders for server data — fewer client waterfalls.
- Avoid unnecessary state; don’t mirror loader data into `useState` without a reason.
- No gratuitous `useMemo` / `useCallback` — add only when profiling shows need.
- Stable list keys; virtualize large tables via ReUI data-grid when lists are long.
- Keep `shouldRevalidate` tight so draft saves don’t refetch the whole shell.
- `useFetcher` for partial updates instead of full navigation when appropriate.

## Async list loading (critical + secondary)

Heavy list routes (`/policies`, `/clients`) used to block the Worker until **all** DB work finished — row fetch, facet badge counts, premium sums, and full `getReferenceDataAsync()` (4 queries). On Workers that stacks query-gate waves, JSON serialization, and SSR into a single request with **Error 1102** risk.

**Workers constraint:** there is no “finish the HTTP response, keep querying in the background” in the same request. “Return quickly, load when ready” means either a **smaller synchronous loader** and/or a **second request after paint** via `useFetcher` + `api/*` (same pattern as `/api/search` in `app/hooks/search/use-api.ts`). This app does **not** use React Router `defer()` / `<Await>`.

### Split critical vs secondary

| Tier          | What                                    | When                     | Example                                           |
| ------------- | --------------------------------------- | ------------------------ | ------------------------------------------------- |
| **Critical**  | Table rows + pagination + filter echo   | SSR loader (first paint) | `listPoliciesPageCore()`, `listClientsPage()`     |
| **Secondary** | Filter badge counts, live AM/AR lookups | `useFetcher` after mount | `/api/policies/list-stats`, `/api/reference/list` |

Static catalogue fields (`policyStatuses`, `coverTypes`, …) come from `app/lib/reference-data.ts` on the client. Only **live** account managers and ARs need a DB round-trip.

### Reference implementation

```
GET /policies (loader)     → count + page rows (~2 queries)
GET /api/policies/list-stats → facet counts + live AM/AR (one Worker request)
GET /api/reference/list    → AM + AR (clients list; sessionStorage cache)
```

Key files:

| Piece                        | Location                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Core row fetch               | `listPoliciesPageCore()` in `app/lib/services/policies/list.service.ts`                       |
| Meta counts + live reference | `getPolicyListMeta()` + `getListReferenceAsync()` in `app/routes/api/policies.list-stats.tsx` |
| Live reference (clients)     | `getListReferenceAsync()` + `app/routes/api/reference.list.tsx`                               |
| Client hooks                 | `usePolicyListStats`, `useListReference`, `useReferenceSessionFetch` in `app/hooks/`          |
| Badge UX while pending       | `countsPending` → em dash in column filter headers                                            |

**Hydration:** `useListReference` must not read `sessionStorage` during the initial render — only after mount in `useEffect`. Server and first client paint both use static `referenceData`; live AM/AR replaces it post-hydration.

### When to apply

Use this pattern when a list loader has **any** of:

- More than **~4** DB queries per request
- Multiple **waves** through the query gate (see below)
- Aggregate scans for filter badges the user may never open
- Full `getReferenceDataAsync()` when the UI only needs AM/AR

Keep synchronous loaders for detail pages that need premium totals and meta on first paint (e.g. `/clients/:id` policies tab).

### Policy detail (`/policies/:id`)

The policy wizard loader returns **policy + client name only** (~2 queries). Secondary data loads after paint:

| Data             | Hook / API                                                  | When                                            |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Broker fee lines | `usePolicyFeeNames` → `/api/reference/fee-names`            | After mount (session-cached per inception date) |
| CAR wording      | `useCarWording` → `/api/car-wording`                        | When Premium or Claims section is open          |
| Note authors     | `usePolicyNoteAuthors` → `/api/policies/:id/note-authors`   | When policy has notes                           |
| Email compose    | `usePolicyEmailCompose` → `/api/policies/:id/email-compose` | When user opens Send email                      |

**Save without revalidation:** `intent=save` returns `{ ok, policy, message }`; `shouldRevalidate` skips the loader. Local policy state updates via `usePolicySaveSync` + toast — avoids re-running email directory scans on status change.

Static reference fields (`coverTypes`, `states`, …) come from `referenceData` on the client; only `feeNames` is merged from the async hook. While fee names load, the premium breakdown shows skeleton rows (`referenceFeeNamesPending`).

### Adding a new async list route

1. Split service into **core** (rows) and **meta** (counts/options).
2. Slim the route loader to core + pagination only.
3. Add `GET /api/<domain>/list-stats` (or split meta + reference endpoints) with `requireAuth` + Zod (mirror list URL params).
4. Add a `useFetcher` hook; reload when filter search params change (omit `page` / `pageSize` for secondary data).
5. Show rows immediately; badges/options fill in with `—` or skeleton while pending.
6. Tighten `shouldRevalidate` — revalidate on mutations, not `return true` always.

## Early warning before Worker CPU limits

Error **1102** (`Worker exceeded resource limits`) means CPU time and/or memory blew past the plan limit. By the time users see 1102, the route is already broken — the goal is to **warn while still fast** so you can refactor (loader diet → async secondary) before production data triggers timeouts.

### Signals already in the app

| Signal               | Where                                               | Meaning                                                                      |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `request.complete`   | `workers/app.ts`                                    | Wall-clock `durationMs` per request (includes I/O wait, not pure CPU)        |
| `request.slow`       | `workers/app.ts`                                    | **Warn** ≥ 2 s, **error** ≥ 8 s — refactor before 1102                       |
| `db.query_gate_slow` | `app/lib/db/query-gate.ts`                          | Query waited ≥ 500 ms for a gate slot — too many parallel queries or slow DB |
| `SLOW_OPERATION:*`   | `app/lib/performance/internal-monitoring.server.ts` | Wrapped operation exceeded its threshold (Sentry message)                    |

Cloudflare dashboard: **Metrics → Errors → Exceeded CPU Time Limits** (`exceededCpu`). CPU time ≠ wall clock, but list routes with many queries + large JSON usually climb both.

### Refactor triggers (code review)

Treat these as **yellow flags** — fix before preview/UAT shows 1102:

| Trigger                                                  | Action                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| Loader runs **> 4** parallel `getDb()` calls in one wave | Split into waves or combine SQL                                       |
| Loader runs **> 6** total queries                        | Move badge counts / reference to `api/*` + `useFetcher`               |
| `getReferenceDataAsync()` on a list page                 | Static catalogue + `getListReferenceAsync()` or `/api/reference/list` |
| Unused aggregates (e.g. premium sum on index)            | Drop or gate behind `includePremium`                                  |
| `request.slow` or `durationMs` **> 2 s** on a list route | Profile queries; apply async list pattern                             |
| `request.slow` **error** (≥ 8 s) or `exceededCpu` in CF  | Urgent — slim loader immediately                                      |

### Query budget worksheet

Before merging a list loader, count queries:

```
Wave 1 (≤4 parallel): count + rows + ?
Wave 2 (≤4 parallel): meta group counts + ?
Wave 3: ...
```

Target for index loaders: **one wave of ≤4** (gate max; pool allows 5 connections). Push badge counts and live reference to secondary `api/*` fetchers.

### Optional: wrap hot loaders

For routes you are actively tuning, wrap the loader body:

```typescript
import { monitorCriticalOperation } from "~/lib/performance/internal-monitoring.server";

export async function loader({ request }: Route.LoaderArgs) {
  return monitorCriticalOperation(
    "policiesListLoad",
    async () => {
      // loader logic
    },
    1500,
  );
}
```

Thresholds live in `OPERATION_TIMEOUTS` (`listPageLoad: 1500`). Exceeding threshold emits `SLOW_OPERATION:…` to Sentry (warning) or error at 2× threshold.

### Alerting (UAT / prod)

1. **Cloudflare Workers Observability** — chart p95 CPU time; alert on `exceededCpu` > 0.
2. **Log filter** — `request.slow` or `request.complete` where `durationMs > 2000` on `/policies`, `/clients`.
3. **Sentry** — issue alert on `SLOW_OPERATION:listPageLoad` or `SLOW_OPERATION:policiesListLoad`.

Incident flow: `requestId` from response header → Workers Logs → identify query fan-out → split loader per async list pattern above.

## Bundle & Workers

This app SSR-renders on **Cloudflare Workers** (≈128 MB isolate, CPU limits). Bundle bloat causes **Error 1102** (`Worker exceeded resource limits`), deploy size failures, and slow cold starts. Prefer **smaller builds** over convenience imports.

### Hard rules

- Don’t import `*.server.ts` from client components (bundle + security).
- Avoid new heavy client libraries without approval.
- Prefer existing shadcn/ReUI over custom widget stacks.
- **Never** top-level-import these into route modules or anything the Worker SSR graph always loads:
  - `@pdfme/ui`, `@pdfme/converter` — Designer only; dynamic `import()` after mount (SSR-stubbed in `vite.stub-client-only.ts`)
  - `@pdfme/generator` — dynamic `import()` **inside** the PDF-generating function only (Preview, email, download)
  - TipTap / `@react-email/editor` / ProseMirror — same client-only pattern
- If a route needs a **light** helper next to a heavy module, **split the helper** into its own file that does not import the heavy package (e.g. `template-override-cache.ts` vs `generate.ts`).
- When adding another browser-only package, add its prefix to `CLIENT_ONLY_PREFIXES` in `vite.stub-client-only.ts`.

### Loader / response size

- Don’t embed full pdfme templates (or other large JSON) for every history/version row in a loader.
- Fetch large payloads **on demand** via `api/*` when the user Preview / Open / Download.
- Prefer latest + published queries over loading every version when only metadata is needed.
- Resource routes: keep JSON small; return DTOs, not graphs of raw rows.
- Prefer signed R2 links over embedding large binaries in responses.

### Mentality

Ask before every new import: _“Does the Worker need this on every request to this route?”_ If no → dynamic import, client-only stub, or a separate light module.

### PDF Worker boundary

Server PDF generation belongs to the private document Worker
(`wrangler.pdf.jsonc`), not the React Router SSR graph. The application
Worker owns auth, policy/template reads, and email orchestration, then sends a
bounded render snapshot through `DOCUMENT_SERVICE`. Browser preview remains a
client-only dynamic import and does not call the document Worker.

Measured dry-run baseline after the split (2026-08-05):

- application Worker: **1,781.08 KiB gzip** (previously 2,651.54 KiB);
- document Worker: **1,392.28 KiB gzip**;
- document fonts: static-assets binding, excluded from script compression.

Deploy the document Worker before an application version that references it.
Both Worker sizes must be measured independently with Wrangler dry runs.

## Email & external I/O

- Don’t send mail from loaders.
- Timeout and error-wrap external calls; fail into `ExternalServiceError`.
- Feature-flag expensive or unfinished paths.

## How to optimize

1. Reproduce with a realistic dataset.
2. Measure (query time, waterfalls, interaction delay).
3. Fix the largest cost first.
4. Re-measure.
5. Only then consider caching or memoization.
