# Observability (Cloudflare + Sentry)

Production debugging stack for the Irecon CAR broker portal.

## Split of responsibilities

| Layer           | Tool                     | Use for                                                                            |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Worker runtime  | Cloudflare Observability | Invocation logs, auto traces (fetch / Hyperdrive / R2), metrics, Error 1101/1102   |
| App errors + UX | Sentry                   | Issues, releases, user id/email, Session Replay, browser interactions, performance |
| Business audit  | Postgres audit log       | Intentional mutations (unchanged)                                                  |

## Secrets / env

| Name                            | Where               | Purpose                  |
| ------------------------------- | ------------------- | ------------------------ |
| `SENTRY_DSN`                    | Worker secret       | Server / SSR SDK         |
| `VITE_SENTRY_DSN`               | Build-time (Vite)   | Browser SDK (public DSN) |
| `SENTRY_AUTH_TOKEN`             | Deploy machine / CI | Source map upload        |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Deploy machine / CI | Source map upload        |

Staging: add values to `.env.staging` (see `.env.staging.example`). `npm run deploy:staging` syncs `SENTRY_DSN` and uploads client source maps when the auth token is present.

Builds use Vite `build.sourcemap: "hidden"` (maps on disk, no public `sourceMappingURL` on app chunks). `deploy-staging` uploads `build/client` maps to Sentry, then deletes all `build/**/*.map` so maps are never shipped on the Worker.

## Cloudflare dashboard setup

1. **Workers Observability** — already enabled in `[wrangler.jsonc](../wrangler.jsonc)` (`logs` + `traces`, staging sample rate `1`).
2. **OTLP → Sentry** (optional but recommended):

- Follow [Export to Sentry](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/sentry/)
- Create destinations named `sentry-logs` and `sentry-traces`
- Add `"destinations": ["sentry-logs"]` / `["sentry-traces"]` under `observability.logs` / `observability.traces` in `wrangler.jsonc`

3. **Live debug** — `npx wrangler tail` after deploy; filter logs by `requestId`.

## Sentry product setup

1. Create a Sentry project (JavaScript / Cloudflare).
2. **Alerts** (Settings → Alerts):

- New issue / regression → Slack + email
- Error rate spike → Slack + email

3. **Session Replay** — enabled in `[app/entry.client.tsx](../app/entry.client.tsx)` with **strict masking** (`maskAllText`, `blockAllMedia`, `maskAllInputs`).
4. **User interactions** — `reactRouterTracingIntegration()` records navigations and click-driven spans; they appear on the Replay timeline when tracing is linked.

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

Sentry events are tagged with the same `requestId`. Incident flow:

1. Alert → Sentry issue
2. Open linked Session Replay + trace
3. Copy `requestId` → Cloudflare Workers Logs / `wrangler tail`

## Smoke test

Super-admin only: `/settings/sentry-test`

- **Throw server error** — loader throws; expect Issue + Worker log line
- **Throw client error** — render throw; expect Issue + Replay (when DSN configured)

## Sampling (defaults)

| Signal                               | Staging | Prod                            |
| ------------------------------------ | ------- | ------------------------------- |
| Client traces                        | 100%    | 10%                             |
| Session Replay (all sessions)        | 100%    | 10%                             |
| Session Replay (sessions with error) | 100%    | 100%                            |
| Worker SDK traces                    | 100%    | 10%                             |
| Workers Logs head sample             | 100%    | tune in wrangler when promoting |

Temporarily raise rates in Sentry project settings or env-specific init when investigating an incident.

## Key files

- `[workers/app.ts](../workers/app.ts)` — `withSentry`, requestId, structured logs
- `[app/entry.server.tsx](../app/entry.server.tsx)` — SSR errors + trace meta tags
- `[app/entry.client.tsx](../app/entry.client.tsx)` — Replay + tracing
- `[app/lib/observability/](../app/lib/observability/)` — logger, request context, Sentry helpers
