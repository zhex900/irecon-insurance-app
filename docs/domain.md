# Production domains

Production app Worker: `insurance-app-production`.

## Custom domains (Wrangler)

Deploy registers **Worker** custom domains (`PRODUCTION_WRANGLER_DOMAINS`, default `app.irecon.net` only — must be a zone on your Cloudflare account).

**Auth redirect allow list** uses `PRODUCTION_AUTH_DOMAINS` (default includes `app.irecon.com.au`) when `SUPABASE_ACCESS_TOKEN` is set during deploy.

## Canonical URL (`APP_URL`)

Set `APP_URL` in `.env.production` to the primary origin used in:

- Password-reset / auth emails
- Supabase Auth `site_url`
- Excel Worker `APP_URL` secret

Both domains are allowed for auth redirects on deploy (when `SUPABASE_ACCESS_TOKEN` is set).

Default: `https://app.irecon.net`

## DNS checklist

### `app.irecon.net` (your Cloudflare zone)

- Proxied `CNAME` or `A` record pointing at the Worker custom domain target Cloudflare shows after first deploy.

### `app.irecon.com.au` (client zone)

Ask their DNS admin for:

1. `app.irecon.com.au` → CNAME → your Cloudflare entry hostname (or `app.irecon.net` if using Custom Hostnames fallback origin).
2. `_acme-challenge.app.irecon.com.au` → CNAME → DCV target from **SSL/TLS → Custom Hostnames** (if using Cloudflare for SaaS).

## Deploy

```bash
npm run deploy:prod
```

Re-deploy after DNS is live so Wrangler registers custom domains and Supabase auth allow list is updated.
