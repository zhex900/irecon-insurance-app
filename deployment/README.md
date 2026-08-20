# Deployment

Cloudflare Workers deploy, per-PR preview environments, env-file generation for CI, and database/R2 copying between environments.

## Layout

```text
deployment/
├── deploy.mjs                 UAT + per-PR preview deploy
├── deploy-production.mjs      Production deploy
├── destroy-preview.mjs        Tear down PR preview resources
├── ci-write-env.mjs           Write .env.pr / .env.uat / .env.production in CI
├── bootstrap-r2-envs.mjs      One-time R2 bucket population
├── copy-uat-to-local.mjs      Full UAT → local Supabase copy
├── copy-uat-to-prod.mjs       Full UAT → production copy (destructive)
├── configure-uat-auth-urls.mjs  Supabase Auth URLs for UAT
└── lib/                       Shared deploy helpers (preview env, R2, Hyperdrive, Sentry)
    └── constants.mjs            Worker/R2/Supabase/wrangler constants
```

## Common commands

| npm script                          | Script                             |
| ----------------------------------- | ---------------------------------- |
| `deploy`, `deploy:pr`, `deploy:uat` | `deployment/deploy.mjs`            |
| `deploy:prod`                       | `deployment/deploy-production.mjs` |
| `destroy`, `destroy:pr`             | `deployment/destroy-preview.mjs`   |
| `db:copy:uat`                       | `deployment/copy-uat-to-local.mjs` |
| `db:copy:prod`                      | `deployment/copy-uat-to-prod.mjs`  |
| `deployment:bootstrap:r2`           | `deployment/bootstrap-r2-envs.mjs` |

See [docs/deployment/preview-environments.md](../docs/deployment/preview-environments.md) and [docs/deployment/observability.md](../docs/deployment/observability.md).
