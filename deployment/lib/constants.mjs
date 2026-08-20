/**
 * Deployment constants — Workers, Hyperdrive, Supabase, R2, wrangler, and CI.
 *
 * Import from here instead of scattering literals across deploy scripts.
 */

// ── Worker CPU / DB pooling ────────────────────────────────────────────────

/** Workers Paid: max CPU ms per invocation (Cloudflare allows up to 300_000). */
export const WORKER_CPU_MS = 60_000;

export const workerCpuLimits = {
  limits: { cpu_ms: WORKER_CPU_MS },
};

/**
 * Hyperdrive `origin_connection_limit` per deploy target.
 * Keep each value at or below that Supabase project's pool size (see SUPABASE_POOL_SIZE).
 * PR previews share one Hyperdrive config and one DB — do not multiply per PR Worker.
 */
export const HYPERDRIVE_ORIGIN_CONNECTION_LIMIT = {
  /** Single Hyperdrive → production Supabase (Small: pool 50, max_connections 90). */
  production: 50,
  uat: 35,
  /** Single shared Hyperdrive for all `pr-*` Workers → shared PR Supabase. */
  pr: 35,
};

/** Supabase Dashboard → Database → Connection pooling → Pool size (manual). */
export const SUPABASE_POOL_SIZE = {
  /** Production Small tier — leave ~40 headroom on 90 max_connections for direct/migrations. */
  production: 50,
  uat: 35,
  /** Shared PR Supabase — align with HYPERDRIVE_ORIGIN_CONNECTION_LIMIT.pr. */
  pr: 35,
};

/** Worker postgres pool max (Hyperdrive pools origins; see app/lib/db/query-gate.ts). */
export const WORKER_DB_POOL_MAX = 1;
/** Dev-only parallel query cap (app/lib/db/query-gate.ts DEV_QUERY_GATE_MAX). */
export const DEV_DB_QUERY_GATE_MAX = 3;

// ── Cloudflare / domain ────────────────────────────────────────────────────

export const PREVIEW_DOMAIN_ZONE = "irecon.net";
export const WORKERS_DEV_SUBDOMAIN = "zhex900";
export const DEFAULT_REGION = "ap-southeast-2";

export const SUPABASE_API = "https://api.supabase.com/v1";

// ── Supabase project refs ──────────────────────────────────────────────────

export const UAT_PROJECT_REF = "tjnsygunohylofihoksl";

// ── Worker name prefixes (preview slugs append `-<slug>`) ──────────────────

export const APP_WORKER_PREFIX = "insurance-app";
export const PDF_WORKER_PREFIX = "insurance-pdf-worker";
export const EXCEL_WORKER_PREFIX = "insurance-excel-worker";

// ── UAT (fixed names) ──────────────────────────────────────────────────────

export const UAT_APP_URL = "https://uat.irecon.net";
export const UAT_APP_WORKER = "insurance-app-uat";
export const UAT_PDF_WORKER = "insurance-pdf-worker-uat";
export const UAT_EXCEL_WORKER = "insurance-excel-worker-uat";
export const UAT_HYPERDRIVE_NAME = "insurance-app-uat";

// ── Production (fixed names) ─────────────────────────────────────────────────

export const PRODUCTION_APP_WORKER = "insurance-app-production";
export const PRODUCTION_PDF_WORKER = "insurance-pdf-worker-production";
export const PRODUCTION_EXCEL_WORKER = "insurance-excel-worker-production";
export const DEFAULT_PRODUCTION_APP_URL = "https://app.irecon.net";

/** Wrangler custom domains — must be zones on your Cloudflare account. */
export const DEFAULT_PRODUCTION_WRANGLER_CUSTOM_DOMAINS = ["app.irecon.net"];

/** Public app hostnames (Auth redirect allow list). Includes external SaaS hostnames. */
export const DEFAULT_PRODUCTION_AUTH_DOMAINS = [
  "app.irecon.net",
  "app.irecon.com.au",
];

// ── R2 bucket names ────────────────────────────────────────────────────────

/** Prefix for per-preview avatars buckets: `insurance-app-avatars-<slug>`. */
export const R2_AVATARS_BUCKET_PREFIX = "insurance-app-avatars";

/** Prefix for per-preview library buckets: `insurance-app-library-documents-<slug>`. */
export const R2_LIBRARY_BUCKET_PREFIX = "insurance-app-library-documents";

/** Original shared buckets — source for one-time `npm run deployment:bootstrap:r2`. */
export const LEGACY_AVATARS_BUCKET = R2_AVATARS_BUCKET_PREFIX;
export const LEGACY_LIBRARY_BUCKET = R2_LIBRARY_BUCKET_PREFIX;

export const UAT_AVATARS_BUCKET = `${R2_AVATARS_BUCKET_PREFIX}-uat`;
export const UAT_LIBRARY_BUCKET = `${R2_LIBRARY_BUCKET_PREFIX}-uat`;
export const LOCAL_AVATARS_BUCKET = `${R2_AVATARS_BUCKET_PREFIX}-local`;
export const LOCAL_LIBRARY_BUCKET = `${R2_LIBRARY_BUCKET_PREFIX}-local`;
/** Shared by all PR preview Workers (`pr-1`, `pr-11`, …). Not deleted on PR cleanup. */
export const PR_AVATARS_BUCKET = `${R2_AVATARS_BUCKET_PREFIX}-pr`;
export const PR_LIBRARY_BUCKET = `${R2_LIBRARY_BUCKET_PREFIX}-pr`;
/** Shared Hyperdrive for all `pr-*` Workers — one pool to shared PR Postgres. */
export const PR_HYPERDRIVE_NAME = `${APP_WORKER_PREFIX}-pr`;
export const PRODUCTION_AVATARS_BUCKET = `${R2_AVATARS_BUCKET_PREFIX}-production`;
export const PRODUCTION_LIBRARY_BUCKET = `${R2_LIBRARY_BUCKET_PREFIX}-production`;

/** Longest preview R2 bucket slug (Cloudflare 63 char max on bucket name). */
export const R2_SLUG_MAX_LEN = 63 - `${R2_LIBRARY_BUCKET_PREFIX}-`.length;

// ── R2 bootstrap presets ───────────────────────────────────────────────────

export const R2_BOOTSTRAP_TARGETS = {
  uat: {
    avatarsBucket: UAT_AVATARS_BUCKET,
    libraryBucket: UAT_LIBRARY_BUCKET,
  },
  local: {
    avatarsBucket: LOCAL_AVATARS_BUCKET,
    libraryBucket: LOCAL_LIBRARY_BUCKET,
  },
  pr: {
    avatarsBucket: PR_AVATARS_BUCKET,
    libraryBucket: PR_LIBRARY_BUCKET,
  },
};

export const R2_BOOTSTRAP_SOURCE_PRESETS = {
  legacy: {
    avatarsBucket: LEGACY_AVATARS_BUCKET,
    libraryBucket: LEGACY_LIBRARY_BUCKET,
  },
  uat: {
    avatarsBucket: UAT_AVATARS_BUCKET,
    libraryBucket: UAT_LIBRARY_BUCKET,
  },
};

// ── Deploy CLI flags / reserved env names ──────────────────────────────────

export const RESERVED_ENV_NAMES = new Set([
  "uat",
  "production",
  "prod",
  "local",
  "development",
  "dev",
  "excel",
  "pdf",
]);

export const PREVIEW_SCRIPT_FLAGS = new Set([
  "--dry-run",
  "--skip-db",
  "--skip-r2",
  "--skip-build",
  "--skip-migrate",
  "--skip-hyperdrive",
  "--refresh-data",
  "--secret-only",
]);

export const PRODUCTION_SCRIPT_FLAGS = new Set([
  "--skip-build",
  "--skip-migrate",
  "--secret-only",
  "--dry-run",
]);

export const MAX_ENV_NAME_LENGTH = 128;

// ── Wrangler / observability ───────────────────────────────────────────────

export const WRANGLER_APP_COMPATIBILITY_DATE = "2026-07-20";
export const WRANGLER_EXCEL_COMPATIBILITY_DATE = "2026-08-08";
export const WRANGLER_COMPATIBILITY_FLAGS = ["nodejs_compat"];
export const EXCEL_WORKER_VERSION = "2.0.0";

export const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES = "30";
export const DEFAULT_SESSION_ABSOLUTE_TIMEOUT_HOURS = "12";

export const observability = {
  enabled: true,
  logs: {
    enabled: true,
    head_sampling_rate: 1,
    destinations: ["sentry-logs"],
  },
  traces: {
    enabled: true,
    head_sampling_rate: 1,
    destinations: ["sentry-traces"],
  },
};

/** Paths relative to `.preview-envs/<label>/`. */
export const PREVIEW_WRANGLER_PATHS = {
  schema: "../../node_modules/wrangler/config-schema.json",
  appMain: "../../build/server/index.js",
  appBaseDir: "../../build/server",
  appAssets: "../../build/client",
  pdfMain: "../../workers/pdf/index.ts",
  excelMain: "../../workers/excel/index.ts",
  fonts: "../../public/fonts",
};

/** Paths relative to `.production-env/`. */
export const PRODUCTION_WRANGLER_PATHS = {
  schema: "../node_modules/wrangler/config-schema.json",
  appMain: "../build/server/index.js",
  appBaseDir: "../build/server",
  appAssets: "../build/client",
  pdfMain: "../workers/pdf/index.ts",
  excelMain: "../workers/excel/index.ts",
  fonts: "../public/fonts",
};

// ── Auth redirect helpers ──────────────────────────────────────────────────

export const LOCAL_DEV_AUTH_ORIGINS = [
  "http://127.0.0.1:5173/**",
  "http://localhost:5173/**",
];

export const PASSWORD_RESET_EMAIL_SUBJECT = "Reset your password";

export const PASSWORD_RESET_EMAIL_TEMPLATE =
  '<h2>Reset your password</h2><p>We received a request to reset your password. Follow the link below to choose a new one.</p><p><a href="{{ .ConfirmationURL }}">Reset password</a></p><p>If you didn\'t request this, you can safely ignore this email.</p>';

// ── CI env-file keys (GitHub Actions → .env.*) ─────────────────────────────

export const CI_ENV_PROFILE_KEYS = {
  uat: [
    "APP_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
    "VITE_SENTRY_DSN",
    "SENTRY_DSN",
    "VITE_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ],
  pr: [
    "BASE_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "UAT_DATABASE_URL",
    "UAT_SUPABASE_URL",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_S3_ENDPOINT",
    "SUPABASE_ACCESS_TOKEN",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
    "VITE_SENTRY_DSN",
    "SENTRY_DSN",
  ],
  production: [
    "APP_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
    "VITE_SENTRY_DSN",
    "SENTRY_DSN",
    "VITE_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ],
};
