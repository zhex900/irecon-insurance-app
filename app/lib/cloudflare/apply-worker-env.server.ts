import type { CloudflareEnv } from "~/lib/cloudflare.server";

/** Postgres from local Supabase CLI (`supabase start`, port 54322). */
export function isLocalSupabasePostgresUrl(url: string): boolean {
  const t = url.trim().toLowerCase();
  return (
    t.includes("127.0.0.1") || t.includes("localhost") || t.includes(":54322")
  );
}

/** Auth/API from local Supabase CLI (port 54321). */
export function isLocalSupabaseAuthUrl(url: string): boolean {
  const t = url.trim().toLowerCase();
  return (
    t.includes("127.0.0.1") || t.includes("localhost") || t.includes(":54321")
  );
}

/** Avoid pointing login at hosted Supabase while Hyperdrive uses local Postgres. */
export function shouldApplyWorkerSupabaseUrl(options: {
  dev: boolean;
  databaseUrl: string;
  workerSupabaseUrl: string;
}): boolean {
  if (!options.dev) return true;
  if (!isLocalSupabasePostgresUrl(options.databaseUrl)) return true;
  return isLocalSupabaseAuthUrl(options.workerSupabaseUrl);
}

export function applyWorkerRuntimeEnv(
  env: CloudflareEnv,
  options: { dev: boolean },
) {
  const hyperdrive = env.HYPERDRIVE;
  if (hyperdrive?.connectionString) {
    process.env.DATABASE_URL = hyperdrive.connectionString;
  } else if (env.DATABASE_URL) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (
    env.SUPABASE_URL &&
    shouldApplyWorkerSupabaseUrl({
      dev: options.dev,
      databaseUrl,
      workerSupabaseUrl: env.SUPABASE_URL,
    })
  ) {
    process.env.SUPABASE_URL = env.SUPABASE_URL;
  }
  if (env.SUPABASE_PUBLISHABLE_KEY) {
    process.env.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
  }
  if (env.SUPABASE_SECRET_KEY) {
    process.env.SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;
  }
  if (env.APP_URL) process.env.APP_URL = env.APP_URL;
  if (env.RESEND_API_KEY) process.env.RESEND_API_KEY = env.RESEND_API_KEY;
  if (env.EMAIL_FROM) process.env.EMAIL_FROM = env.EMAIL_FROM;
  if (env.SENTRY_DSN) process.env.SENTRY_DSN = env.SENTRY_DSN;
  if (env.TURNSTILE_SECRET_KEY) {
    process.env.TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY;
  }
  if (env.SESSION_INACTIVITY_TIMEOUT_MINUTES != null) {
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES =
      env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
  }
  if (env.SESSION_ABSOLUTE_TIMEOUT_HOURS != null) {
    process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS =
      env.SESSION_ABSOLUTE_TIMEOUT_HOURS;
  }
}
