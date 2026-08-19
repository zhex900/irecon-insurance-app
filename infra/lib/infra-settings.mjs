/**
 * Shared infrastructure targets for Cloudflare Workers, Hyperdrive, and Supabase.
 *
 * Deploy scripts import these constants. Supabase pool size is applied manually in
 * each project's dashboard (Database → Connection pooling).
 */

/** Workers Paid: max CPU ms per invocation (Cloudflare allows up to 300_000). */
export const WORKER_CPU_MS = 60_000;

export const workerCpuLimits = {
  limits: { cpu_ms: WORKER_CPU_MS },
};

/**
 * Hyperdrive `origin_connection_limit` per deploy target (wrangler hyperdrive create/update).
 * Paid Workers plan allows up to ~100 per config.
 *
 * Keep each value below that Supabase project's direct `max_connections` minus ~15
 * headroom (migrations, dashboard, deploy scripts). PR previews share one DB — limits
 * from multiple Hyperdrive configs add up.
 */
export const HYPERDRIVE_ORIGIN_CONNECTION_LIMIT = {
  production: 100,
  uat: 80,
  pr: 80,
};

/**
 * Supabase Dashboard → Project → Database → Connection pooling → Pool size.
 * Session mode (port 5432) for Hyperdrive; see infra/lib/preview-env.mjs `toSessionDbUrl`.
 */
export const SUPABASE_POOL_SIZE = {
  production: 20,
  uat: 12,
  pr: 10,
};

/** Documented targets for app-side pooling (implemented in app/lib/db/query-gate.ts). */
export const WORKER_DB_POOL_MAX = 5;
export const WORKER_DB_QUERY_GATE_MAX = 4;
