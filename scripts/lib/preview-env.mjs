/**
 * Shared helpers for per-PR preview environments.
 *
 *   npm run deploy --env pr-11
 *   npm run destroy --env pr-11
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const webRoot = join(__dirname, "../..");
export const previewRoot = join(webRoot, ".preview-envs");

export const UAT_PROJECT_REF = "tjnsygunohylofihoksl";
export const UAT_AVATARS_BUCKET = "insurance-app-avatars";
export const UAT_LIBRARY_BUCKET = "insurance-app-library-documents";
export const PREVIEW_DOMAIN_ZONE = "irecon.net";
export const WORKERS_DEV_SUBDOMAIN = "zhex900";
export const DEFAULT_REGION = "ap-southeast-2";

/** Hostname for PR preview URLs — from `.env.pr` `BASE_URL`, default `irecon.net`. */
export function previewBaseDomain() {
  const raw =
    process.env.BASE_URL?.trim() ||
    process.env.PREVIEW_DOMAIN?.trim() ||
    PREVIEW_DOMAIN_ZONE;
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** @deprecated Use UAT_* constants */
export const STAGING_PROJECT_REF = UAT_PROJECT_REF;
/** @deprecated Use UAT_* constants */
export const STAGING_AVATARS_BUCKET = UAT_AVATARS_BUCKET;
/** @deprecated Use UAT_* constants */
export const STAGING_LIBRARY_BUCKET = UAT_LIBRARY_BUCKET;

const RESERVED_ENVS = new Set([
  "uat",
  "production",
  "prod",
  "local",
  "development",
  "dev",
  "excel",
  "pdf",
]);

const SCRIPT_FLAGS = new Set([
  "--dry-run",
  "--skip-db",
  "--skip-r2",
  "--skip-build",
  "--skip-migrate",
  "--skip-hyperdrive",
  "--refresh-data",
  "--secret-only",
]);

/** Longest preview R2 bucket: `insurance-app-library-documents-<slug>` (63 char max). */
const R2_SLUG_MAX_LEN = 63 - "insurance-app-library-documents-".length;

export function parseEnvName(argv = process.argv.slice(2)) {
  const eq = argv.find((arg) => arg.startsWith("--env="));
  const idx = argv.indexOf("--env");
  const fromArg =
    eq?.slice("--env=".length) ?? (idx >= 0 ? argv[idx + 1] : undefined);

  const fromNpm = process.env.npm_config_env?.trim();
  const npmSlug =
    fromNpm && fromNpm !== "true" && fromNpm !== "false" ? fromNpm : "";

  const positional = argv.find(
    (arg) => !arg.startsWith("-") && !SCRIPT_FLAGS.has(arg),
  );

  return (
    fromArg ||
    process.env.PREVIEW_ENV?.trim() ||
    npmSlug ||
    positional ||
    ""
  ).trim();
}

/** Normalize a user-provided env label into a lowercase slug for CF / Supabase names. */
export function toResourceSlug(name) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error(
      `Environment name "${name}" does not contain any usable characters.`,
    );
  }

  if (slug.length <= R2_SLUG_MAX_LEN) return slug;

  const hash = createHash("sha256").update(slug).digest("hex").slice(0, 8);
  const keep = R2_SLUG_MAX_LEN - hash.length - 1;
  return `${slug.slice(0, keep)}-${hash}`;
}

export function assertPreviewEnvName(name) {
  if (!name?.trim()) {
    throw new Error(
      "Missing --env. Example: npm run deploy --env pr-11\n" +
        "  npm run deploy --env pr-code-review-refactor",
    );
  }

  const trimmed = name.trim();
  const lowered = trimmed.toLowerCase();

  if (RESERVED_ENVS.has(lowered)) {
    throw new Error(
      `Refusing to use reserved environment name "${trimmed}". Use a preview slug such as pr-11.`,
    );
  }

  if (/[/\\:\0]/.test(trimmed)) {
    throw new Error(
      `Invalid environment name "${trimmed}". Slashes and path separators are not allowed.`,
    );
  }

  if (trimmed.length > 128) {
    throw new Error(
      `Environment name "${trimmed}" is too long (max 128 characters).`,
    );
  }

  return trimmed;
}

export function hasFlag(flag, argv = process.argv.slice(2)) {
  if (argv.includes(flag)) return true;
  const name = flag.replace(/^--/, "").replaceAll("-", "_");
  const npmVal = process.env[`npm_config_${name}`];
  return Boolean(npmVal) && npmVal !== "false";
}

/** PR previews: `https://<env-slug>.<BASE_URL>` (e.g. pr-1 → https://pr-1.irecon.net). */
export function previewAppUrl(slug) {
  if (/^pr-.+/.test(slug)) {
    return `https://${slug}.${previewBaseDomain()}`;
  }
  const subdomain =
    process.env.WORKERS_DEV_SUBDOMAIN?.trim() || WORKERS_DEV_SUBDOMAIN;
  return `https://insurance-app-${slug}.${subdomain}.workers.dev`;
}

export function previewCustomDomainRoutes(appUrl) {
  try {
    const host = new URL(appUrl).hostname;
    const base = previewBaseDomain();
    if (host === base || host.endsWith(`.${base}`)) {
      return [{ pattern: host, custom_domain: true }];
    }
  } catch {
    // ignore invalid URL
  }
  return [];
}

export function resourceNames(envName) {
  const label = assertPreviewEnvName(envName);
  const slug = toResourceSlug(label);
  const app = `insurance-app-${slug}`;
  const appUrl = previewAppUrl(slug);
  return {
    label,
    slug,
    appWorker: app,
    pdfWorker: `insurance-pdf-worker-${slug}`,
    excelWorker: `insurance-excel-worker-${slug}`,
    avatarsBucket: `insurance-app-avatars-${slug}`,
    libraryBucket: `insurance-app-library-documents-${slug}`,
    hyperdriveName: app,
    supabaseBranchName: slug,
    appUrl,
  };
}

export function statePath(envName) {
  return join(previewRoot, assertPreviewEnvName(envName), "state.json");
}

export async function loadState(envName) {
  try {
    return JSON.parse(await readFile(statePath(envName), "utf8"));
  } catch {
    return null;
  }
}

export async function saveState(envName, state) {
  const label = assertPreviewEnvName(envName);
  const dir = join(previewRoot, label);
  await mkdir(dir, { recursive: true });
  await writeFile(
    statePath(envName),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

export async function removeStateDir(envName) {
  await rm(join(previewRoot, assertPreviewEnvName(envName)), {
    recursive: true,
    force: true,
  });
}

export function encodeDbPassword(password) {
  return encodeURIComponent(password);
}

export function poolerHost(region = DEFAULT_REGION) {
  return `aws-0-${region}.pooler.supabase.com`;
}

/** Extract project ref from a Supabase URL or pooler/direct Postgres URL. */
export function extractProjectRefFromDbUrl(url) {
  if (!url?.trim()) return null;
  const supabaseMatch = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (supabaseMatch) return supabaseMatch[1];
  const dbHostMatch = url.match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (dbHostMatch) return dbHostMatch[1];
  const poolerUserMatch = url.match(/postgres\.([a-z0-9]+):/i);
  if (poolerUserMatch) return poolerUserMatch[1];
  const missingAtMatch = url.match(
    /postgresql:\/\/postgres:(?:([a-z0-9]+)\.([^.@/]+)|([^.@/]+)\.([a-z0-9]+))\.supabase\.co/i,
  );
  if (missingAtMatch) {
    return missingAtMatch[1] || missingAtMatch[4] || null;
  }
  return null;
}

/**
 * Fix common Supabase URL typos (missing `@db.` between password and host).
 * Example: postgres:pass.ref.supabase.co → postgres:pass@db.ref.supabase.co
 */
export function repairSupabaseDatabaseUrl(databaseUrl, supabaseUrl) {
  const raw = databaseUrl?.trim();
  if (!raw) return raw;
  if (raw.includes("@")) {
    return normalizeSupabasePoolerUrl(raw);
  }

  const ref =
    extractProjectRefFromDbUrl(supabaseUrl) || extractProjectRefFromDbUrl(raw);
  if (!ref) return raw;

  const passwordFirst = raw.match(
    new RegExp(
      `^postgresql://postgres:([^.@/]+)\\.${ref}\\.supabase\\.co(?::(\\d+))?(\\/[^?]*)?(\\?.*)?$`,
      "i",
    ),
  );
  if (passwordFirst) {
    const [
      ,
      password,
      port = "5432",
      path = "/postgres",
      query = "?sslmode=require",
    ] = passwordFirst;
    const fixed = `postgresql://postgres:${encodeDbPassword(password)}@db.${ref}.supabase.co:${port}${path}${query || "?sslmode=require"}`;
    return normalizeSupabasePoolerUrl(fixed);
  }

  const refFirst = raw.match(
    new RegExp(
      `^postgresql://postgres:${ref}\\.([^.@/]+)\\.supabase\\.co(?::(\\d+))?(\\/[^?]*)?(\\?.*)?$`,
      "i",
    ),
  );
  if (refFirst) {
    const [
      ,
      password,
      port = "5432",
      path = "/postgres",
      query = "?sslmode=require",
    ] = refFirst;
    const fixed = `postgresql://postgres:${encodeDbPassword(password)}@db.${ref}.supabase.co:${port}${path}${query || "?sslmode=require"}`;
    return normalizeSupabasePoolerUrl(fixed);
  }

  return normalizeSupabasePoolerUrl(raw);
}

/**
 * Rewrite direct `db.{ref}.supabase.co` URLs to the Supabase pooler hostname.
 * Direct hosts are often IPv6-only and fail from Docker psql ("Name has no usable address").
 */
export function normalizeSupabasePoolerUrl(
  url,
  region = process.env.PREVIEW_REGION?.trim() || DEFAULT_REGION,
) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const match = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (!match) return url;

  const projectRef = match[1];
  const encoded = encodeDbPassword(decodeURIComponent(parsed.password || ""));
  const host = poolerHost(region);
  const port = parsed.port || "5432";
  const dbName = parsed.pathname.replace(/^\//, "") || "postgres";
  const query = parsed.search || "?sslmode=require";
  return `postgresql://postgres.${projectRef}:${encoded}@${host}:${port}/${dbName}${query}`;
}

/** Prefer session-mode (5432) over transaction pooler (6543) for dump / Hyperdrive. */
export function toSessionDbUrl(url) {
  return normalizeSupabasePoolerUrl(url).replace(/:6543(\/|$)/, ":5432$1");
}

/** Transaction pooler (6543) for bulk restore. */
export function toTransactionDbUrl(url) {
  const normalized = normalizeSupabasePoolerUrl(url);
  return normalized.includes(":6543")
    ? normalized
    : normalized.replace(/:5432(\/|$)/, ":6543$1");
}

export function supabaseUrls({ projectRef, password, region }) {
  const encoded = encodeDbPassword(password);
  const host = poolerHost(region);
  return {
    supabaseUrl: `https://${projectRef}.supabase.co`,
    directUrl: `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`,
    sessionUrl: `postgresql://postgres.${projectRef}:${encoded}@${host}:5432/postgres?sslmode=require`,
    transactionUrl: `postgresql://postgres.${projectRef}:${encoded}@${host}:6543/postgres?sslmode=require`,
  };
}

/** Swap the database name in a Postgres URL (e.g. postgres → template1). */
export function withDatabaseName(dbUrl, database) {
  const parsed = new URL(dbUrl);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function run(command, args, { input, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd ?? webRoot,
      stdio: input != null ? ["pipe", "inherit", "inherit"] : "inherit",
      env: env ?? process.env,
    });
    if (input != null) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

export function capture(
  command,
  args,
  { input, cwd, env, silent = false } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd ?? webRoot,
      stdio:
        input != null ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      env: env ?? process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!silent) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (!silent) process.stderr.write(chunk);
    });
    if (input != null) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited ${code}\n${stderr}`.trim(),
          ),
        );
      }
    });
  });
}

export async function captureJson(command, args, options) {
  const { stdout } = await capture(command, args, options);
  const start = stdout.indexOf("{");
  const arrayStart = stdout.indexOf("[");
  const jsonStart =
    start === -1
      ? arrayStart
      : arrayStart === -1
        ? start
        : Math.min(start, arrayStart);
  if (jsonStart < 0) {
    throw new Error(
      `Expected JSON from ${command} ${args.join(" ")} but got:\n${stdout}`,
    );
  }
  return JSON.parse(stdout.slice(jsonStart));
}

export function extractHyperdriveId(text) {
  const jsonMatch = text.match(/"id"\s*:\s*"([a-f0-9]{32})"/i);
  if (jsonMatch) return jsonMatch[1];

  for (const line of text.split("\n")) {
    const tableMatch = line.match(/^\s*[│|]\s*([a-f0-9]{32})\s*[│|]/i);
    if (tableMatch) return tableMatch[1];
  }

  const inlineMatch = text.match(
    /hyperdrive[^a-f0-9]*([a-f0-9]{32})|([a-f0-9]{32})[^a-f0-9]*hyperdrive/i,
  );
  if (inlineMatch) return inlineMatch[1] ?? inlineMatch[2];

  return null;
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function wranglerEnv(extra = {}) {
  return {
    ...process.env,
    CI: "true",
    WRANGLER_LOG: process.env.WRANGLER_LOG ?? "error",
    ...extra,
  };
}

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

import {
  HYPERDRIVE_ORIGIN_CONNECTION_LIMIT,
  SUPABASE_POOL_SIZE,
  WORKER_CPU_MS,
  WORKER_DB_POOL_MAX,
  WORKER_DB_QUERY_GATE_MAX,
  workerCpuLimits,
} from "./infra-settings.mjs";

export {
  HYPERDRIVE_ORIGIN_CONNECTION_LIMIT,
  SUPABASE_POOL_SIZE,
  WORKER_CPU_MS,
  WORKER_DB_POOL_MAX,
  WORKER_DB_QUERY_GATE_MAX,
  workerCpuLimits,
};

/** Paths are relative to `.preview-envs/<label>/` where generated wrangler files live. */
const fromPreviewDir = {
  schema: "../../node_modules/wrangler/config-schema.json",
  appMain: "../../build/server/index.js",
  appBaseDir: "../../build/server",
  appAssets: "../../build/client",
  pdfMain: "../../workers/pdf/index.ts",
  excelMain: "../../workers/excel/index.ts",
  fonts: "../../public/fonts",
};

export function previewAppWrangler({ names, supabaseUrl, hyperdriveId }) {
  const customRoutes = previewCustomDomainRoutes(names.appUrl);
  return {
    $schema: fromPreviewDir.schema,
    name: names.appWorker,
    compatibility_date: "2026-07-20",
    compatibility_flags: ["nodejs_compat"],
    main: fromPreviewDir.appMain,
    no_bundle: true,
    base_dir: fromPreviewDir.appBaseDir,
    rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
    assets: { directory: fromPreviewDir.appAssets },
    ...(customRoutes.length > 0
      ? { workers_dev: false, routes: customRoutes }
      : {}),
    observability,
    upload_source_maps: true,
    placement: { mode: "smart" },
    ...workerCpuLimits,
    vars: {
      SUPABASE_URL: supabaseUrl,
      SESSION_INACTIVITY_TIMEOUT_MINUTES: "30",
      SESSION_ABSOLUTE_TIMEOUT_HOURS: "12",
    },
    services: [
      { binding: "EXCEL_SERVICE", service: names.excelWorker },
      { binding: "PDF_SERVICE", service: names.pdfWorker },
    ],
    hyperdrive: [{ binding: "HYPERDRIVE", id: hyperdriveId }],
    r2_buckets: [
      { binding: "AVATARS", bucket_name: names.avatarsBucket },
      {
        binding: "LIBRARY_DOCUMENTS",
        bucket_name: names.libraryBucket,
      },
    ],
  };
}

export function previewPdfWrangler(names) {
  return {
    $schema: fromPreviewDir.schema,
    name: names.pdfWorker,
    main: fromPreviewDir.pdfMain,
    compatibility_date: "2026-07-20",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    preview_urls: false,
    assets: {
      directory: fromPreviewDir.fonts,
      binding: "ASSETS",
      run_worker_first: true,
    },
    observability,
    ...workerCpuLimits,
  };
}

export function previewExcelWrangler(names) {
  return {
    $schema: fromPreviewDir.schema,
    name: names.excelWorker,
    compatibility_date: "2026-08-08",
    compatibility_flags: ["nodejs_compat"],
    main: fromPreviewDir.excelMain,
    observability,
    ...workerCpuLimits,
    vars: {
      WORKER_VERSION: "2.0.0",
      APP_URL: names.appUrl,
    },
    placement: { mode: "smart" },
    upload_source_maps: true,
  };
}

/** UAT app Worker — deploy prebuilt SSR bundle (includes workers/app.ts wrapper). */
export function uatAppWrangler(params) {
  return previewAppWrangler(params);
}

export function uatStatePath() {
  return join(previewRoot, "uat", "state.json");
}

export async function loadUatState() {
  try {
    return JSON.parse(await readFile(uatStatePath(), "utf8"));
  } catch {
    return null;
  }
}

export async function saveUatState(state) {
  const dir = join(previewRoot, "uat");
  await mkdir(dir, { recursive: true });
  await writeFile(
    uatStatePath(),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

export async function writeJsonc(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
