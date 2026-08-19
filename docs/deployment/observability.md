# Observability (Cloudflare + Sentry)

Production debugging stack for the Irecon CAR broker portal.

## Split of responsibilities

| Layer           | Tool                     | Use for                                                                            |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Worker runtime  | Cloudflare Observability | Invocation logs, auto traces (fetch / Hyperdrive / R2), metrics, Error 1101/1102   |
| App errors + UX | Sentry                   | Issues, releases, user id/email, Session Replay, browser interactions, performance |
| Product usage   | Sentry Metrics           | Counters/distributions for login, search, policies, PDF preview, email, exports    |
| Business audit  | Postgres audit log       | Intentional mutations (unchanged)                                                  |

## Secrets / env

| Name                            | Where               | Purpose                  |
| ------------------------------- | ------------------- | ------------------------ |
| `SENTRY_DSN`                    | Worker secret       | Server / SSR SDK         |
| `VITE_SENTRY_DSN`               | Build-time (Vite)   | Browser SDK (public DSN) |
| `SENTRY_AUTH_TOKEN`             | Deploy machine / CI | Source map upload        |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Deploy machine / CI | Source map upload        |

UAT and production use the **same Sentry project and DSN**. Add values to `.env.uat` / `.env.production` (see `.env.uat.example`). `npm run deploy:uat` and `npm run deploy:prod` sync `SENTRY_DSN` and upload client source maps when the auth token is present.

Builds use Vite `build.sourcemap: "hidden"` (maps on disk, no public `sourceMappingURL` on app chunks). Deploy scripts upload `build/client` maps to Sentry (skipping empty route stubs / helpers that have no `.map`), then delete all `build/**/*.map` so maps are never shipped on the Worker.

## Cloudflare dashboard setup

1. **Workers Observability** — enabled in `[wrangler.jsonc](../wrangler.jsonc)` and `[wrangler.pdf.jsonc](../wrangler.pdf.jsonc)` (`logs` + `traces`, sample rate `1`).
2. **OTLP → Sentry** (required for CF export):

- Follow [Export to Sentry](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/sentry/)
- In the Cloudflare dashboard create destinations named exactly **`sentry-logs`** and **`sentry-traces`**
- Wrangler already references those names under `observability.logs.destinations` / `observability.traces.destinations`
- Redeploy after creating the destinations (export fails silently if names are missing)

3. **Live debug** — `npx wrangler tail` after deploy; filter logs by `requestId`.

## Sentry product setup

1. Create a Sentry project (JavaScript / Cloudflare).
2. **Alerts** (Settings → Alerts):

- New issue / regression → Slack + email
- Error rate spike → Slack + email

3. **Session Replay** — enabled in `[app/entry.client.tsx](../app/entry.client.tsx)` with **strict masking** (`maskAllText`, `blockAllMedia`, `maskAllInputs`).
4. **User interactions** — `reactRouterTracingIntegration()` records navigations and click-driven spans; they appear on the Replay timeline when tracing is linked.
5. **Metrics** — `enableMetrics: true` on client + Worker. Product counters live in `[metrics.server.ts](../app/lib/observability/metrics.server.ts)` / `[metrics.client.ts](../app/lib/observability/metrics.client.ts)`.

### Product metrics (usage)

| Metric                                         | Type                 | When                                                  |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `auth.login`                                   | count                | Sign-in attempt (`result`, `reason` / `role`)         |
| `auth.session_end`                             | count                | App session timeout (`reason`: inactivity / absolute) |
| `client.create` / `client.delete`              | count                | Client create/delete                                  |
| `policy.draft_create`                          | count                | New policy draft                                      |
| `policy.submit`                                | count                | Full policy save (`status_changed`, `to_status`)      |
| `document.generate`                            | count                | Wizard pack / documents API persist                   |
| `document.generate.duration`                   | distribution         | Wizard generation latency (client)                    |
| `document.render` / `document.render.duration` | count / distribution | Document Worker PDF render (email path)               |
| `search.query`                                 | count                | `/api/search` (`type`, `has_query`)                   |
| `email.policy_documents`                       | count                | Policy document email sent                            |
| `email.policy_documents.bytes`                 | distribution         | Attachment payload size                               |
| `report.export`                                | count                | CAR policies / renewals Excel export                  |
| `pdf.preview` / `pdf.preview.duration`         | count / distribution | Client PDF preview                                    |
| `sentry.smoke_metric`                          | count                | Super-admin smoke test                                |

**Rules:** use bounded attributes (enums). Do **not** put user IDs, request IDs, or free-text queries on metrics — those belong in logs / traces / audit.

`logger.warn` / `logger.error` also forward to **Sentry Logs** (`Sentry.logger`) while still writing JSON to Workers Logs.

In Sentry: **Metrics** → chart by name → alert with a Metric Alert on drops/spikes (e.g. login failure rate, PDF preview failures).

## Privacy

- Do not send passwords, tokens, cookies, or full policy/client payloads.
- Server SDK strips request bodies/cookies in `beforeSend`.
- Replay masks all text and inputs by default.
- Tag users with **id + email only**.

## Correlation

Every Worker request gets an `x-request-id` response header and structured JSON logs:

```json
{
  "level": "info",
  "message": "request.complete",
  "requestId": "…",
  "route": "/policies/1",
  "durationMs": 42
}
```

Slow requests also emit `request.slow` (warn ≥ 2 s, error ≥ 8 s) — see [performance.md](../architecture/performance.md) § Early warning before Worker CPU limits. Use these to refactor list loaders **before** Error 1102.

Sentry events are tagged with the same `requestId`. Incident flow:

1. Alert → Sentry issue
2. Open linked Session Replay + trace
3. Copy `requestId` → Cloudflare Workers Logs / `wrangler tail`

## Smoke test

Super-admin only: `/settings/sentry-test`

- **Throw server error** — loader throws; expect Issue + Worker log line
- **Throw client error** — render throw; expect Issue + Replay (when DSN configured)
- **Emit server/client metric** — expect `sentry.smoke_metric` under Metrics

## Sampling (defaults)

| Signal                               | Staging | Prod                            |
| ------------------------------------ | ------- | ------------------------------- |
| Client traces                        | 100%    | 10%                             |
| Session Replay (all sessions)        | 100%    | 10%                             |
| Session Replay (sessions with error) | 100%    | 100%                            |
| Worker SDK traces                    | 100%    | 10%                             |
| Workers Logs head sample             | 100%    | tune in wrangler when promoting |

Temporarily raise rates in Sentry project settings or env-specific init when investigating an incident.

### List-route performance alerts

| Alert                                 | Source             | Suggested action                                                                          |
| ------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `exceededCpu` > 0                     | Cloudflare Metrics | Urgent — slim loader / async secondary ([performance.md](../architecture/performance.md)) |
| `message:request.slow`                | Workers Logs       | Investigate query count on that route                                                     |
| `message:SLOW_OPERATION:listPageLoad` | Sentry             | Same; threshold 1.5 s                                                                     |
| `message:db.query_gate_slow`          | Workers Logs       | Reduce parallel queries or combine SQL                                                    |

## Key files

- `[workers/app.ts](../workers/app.ts)` — `withSentry`, requestId, structured logs
- `[app/entry.server.tsx](../app/entry.server.tsx)` — SSR errors + trace meta tags
- `[app/entry.client.tsx](../app/entry.client.tsx)` — Replay + tracing
- `[app/lib/observability/](../app/lib/observability/)` — logger, request context, Sentry helpers, product metrics
