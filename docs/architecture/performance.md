# Performance

Measure before optimizing. Readability wins over micro-optimizations without evidence ([AGENTS.md](../AGENTS.md) decision rule).

## Database & queries

- **Avoid N+1** — batch or join; don’t query per row in a loop.
- **Paginate** list endpoints and tables (existing list/query-param patterns).
- **Select only needed columns** — no `select *` habit for wide tables.
- **Index** filters you actually use; verify slow paths with `EXPLAIN`.
- **Transactions** for multi-table writes — correct first, then fast.
- Prefer request-scoped `getDb()` / Hyperdrive pooling — don’t open ad-hoc pools per call.
- **Workers query concurrency:** cap at **≤3 parallel** `getDb()` queries per loader/action. Each Worker request gets its **own postgres pool** (`max: 5`, closed after the request) plus a **per-request query gate** in `app/lib/db/client.ts` — pools must not be shared across requests (Workers I/O isolation). Use **waves** of `Promise.all`, **combined SQL** (`count(*) FILTER (WHERE …)` for badge counts), and **one query for feature flags** (`getFeatureFlagStates()`). See `app/lib/services/price/snapshot.ts` and `app/lib/services/policies/list.service.ts`.

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
