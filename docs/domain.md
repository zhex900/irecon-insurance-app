# Domains & environments

All non-production hostnames live on the **irecon.net** Cloudflare zone. Production is served on **app.irecon.net** with **app.irecon.com.au** as a client custom hostname (Cloudflare for SaaS).

## Environment overview

| Environment    | URL                                                                | Worker                      | Database                                                         |
| -------------- | ------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| **Production** | `https://app.irecon.net` (canonical) · `https://app.irecon.com.au` | `insurance-app-production`  | Dedicated Supabase project                                       |
| **UAT**        | `https://uat.irecon.net`                                           | `insurance-app-uat`         | Dedicated Supabase project (formerly staging)                    |
| **PR preview** | `https://pr-<number>.irecon.net`                                   | `insurance-app-pr-<number>` | Shared Supabase project (`.env.pr`), copied from UAT each deploy |

**Shared across all environments:** Sentry (DSN + source maps) and Resend (API key + sender addresses). Use the same values in `.env.uat` and `.env.production`.

## Production

Worker: `insurance-app-production`.

### Custom domains (Wrangler)

Deploy registers Worker custom domains from `PRODUCTION_WRANGLER_DOMAINS` (default `app.irecon.net` — must be a zone on your Cloudflare account).

**Auth redirect allow list** uses `PRODUCTION_AUTH_DOMAINS` (default `app.irecon.net,app.irecon.com.au`) when `SUPABASE_ACCESS_TOKEN` is set during deploy.

### Canonical URL (`APP_URL`)

Set `APP_URL` in `.env.production` to the primary origin:

- Password-reset / auth emails
- Supabase Auth `site_url`
- Excel Worker `APP_URL` secret

Default: `https://app.irecon.net`

Both production hostnames are allowed for auth redirects on deploy (when `SUPABASE_ACCESS_TOKEN` is set).

### `app.irecon.com.au` (client zone → your Worker)

Traffic arrives via Cloudflare for SaaS custom hostnames. You also need a **Workers Route** on the `irecon.net` zone:

1. **Fallback origin** (if not already set): proxied `AAAA` `100::` record (e.g. `fallback.irecon.net`) → set as fallback origin under **SSL/TLS → Custom Hostnames**.
2. **Workers Route**: `app.irecon.com.au/*` → `insurance-app-production`.

Client DNS admin points `app.irecon.com.au` CNAME at your Cloudflare entry hostname and `_acme-challenge.app.irecon.com.au` at the DCV target from Custom Hostnames.

Deploy applies pending `supabase/migrations` to production, then deploys Workers:

```bash
npm run deploy:prod
```

**CI:** publishing a GitHub Release (non-prerelease) runs `.github/workflows/release.yml` → `npm run deploy:prod` on the release tag. Requires a GitHub **environment** named `production` with secrets (see [deployment/preview-environments.md](deployment/preview-environments.md)).

## UAT

Worker: `insurance-app-uat` · URL: `https://uat.irecon.net`.

Secrets and vars: `.env.uat` (see `.env.uat.example`). Deploy:

```bash
npm run deploy:uat
# or default when no --env:
npm run deploy
```

Configure Supabase Auth Site URL after first deploy:

```bash
node --env-file=.env.uat infra/configure-uat-auth-urls.mjs
```

## PR preview environments

Per-PR Workers at `https://pr-<number>.irecon.net`. All PRs share one Supabase project (`.env.pr`); each deploy copies UAT into that database.

```bash
npm run deploy -- pr-11
npm run destroy -- pr-11
```

See [deployment/preview-environments.md](deployment/preview-environments.md) for provisioning details, CI, and secrets.

## DNS checklist (`irecon.net` zone)

| Hostname          | Type            | Target                                                              |
| ----------------- | --------------- | ------------------------------------------------------------------- |
| `app.irecon.net`  | Proxied CNAME/A | Worker custom domain (from first prod deploy)                       |
| `uat.irecon.net`  | Proxied CNAME/A | Worker custom domain (from first UAT deploy)                        |
| `pr-*.irecon.net` | Proxied CNAME/A | Worker custom domain per preview deploy (or wildcard if configured) |

Enable **Always Use HTTPS** on the zone.
