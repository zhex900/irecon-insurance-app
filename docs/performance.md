# Performance

Measure before optimizing. Readability wins over micro-optimizations without evidence ([AGENTS.md](../AGENTS.md) decision rule).

## Database & queries

- **Avoid N+1** — batch or join; don’t query per row in a loop.
- **Paginate** list endpoints and tables (existing list/query-param patterns).
- **Select only needed columns** — no `select *` habit for wide tables.
- **Index** filters you actually use; verify slow paths with `EXPLAIN`.
- **Transactions** for multi-table writes — correct first, then fast.
- Prefer request-scoped `getDb()` / Hyperdrive pooling — don’t open ad-hoc pools per call.

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

- Don’t import `*.server.ts` from client components (bundle + security).
- Avoid new heavy client libraries without approval.
- Prefer existing shadcn/ReUI over custom widget stacks.
- Be mindful of Worker CPU/size limits — keep pure pricing logic lean.

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
