/**
 * Production deploy helpers (Workers, R2, Hyperdrive, generated wrangler configs).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import {
  observability,
  UAT_AVATARS_BUCKET,
  UAT_LIBRARY_BUCKET,
  UAT_PROJECT_REF,
  webRoot,
  writeJsonc,
} from "./preview-env.mjs";

export const productionRoot = join(webRoot, ".production-env");

export const PRODUCTION_APP_WORKER = "insurance-app-production";
export const PRODUCTION_PDF_WORKER = "insurance-pdf-worker-production";
export const PRODUCTION_EXCEL_WORKER = "insurance-excel-worker-production";
export const PRODUCTION_R2_HELPER_WORKER = "insurance-r2-copy-production";
export const PRODUCTION_AVATARS_BUCKET = "insurance-app-avatars-production";
export const PRODUCTION_LIBRARY_BUCKET =
  "insurance-app-library-documents-production";
export const DEFAULT_PRODUCTION_APP_URL = "https://app.irecon.net";

/** Max CPU ms per invocation on Workers Paid (30 seconds). */
export const PRODUCTION_CPU_MS = 30_000;

const productionWorkerLimits = {
  limits: { cpu_ms: PRODUCTION_CPU_MS },
};

/** Wrangler custom domains — must be zones on your Cloudflare account. */
export const DEFAULT_PRODUCTION_WRANGLER_CUSTOM_DOMAINS = ["app.irecon.net"];

/** All public app hostnames (Auth redirect allow list). Includes external SaaS hostnames. */
export const DEFAULT_PRODUCTION_AUTH_DOMAINS = [
  "app.irecon.net",
  "app.irecon.com.au",
];

export function productionWranglerCustomDomains() {
  const fromEnv = process.env.PRODUCTION_WRANGLER_DOMAINS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((domain) => domain.trim().replace(/^https?:\/\//, ""))
      .filter(Boolean);
  }
  return [...DEFAULT_PRODUCTION_WRANGLER_CUSTOM_DOMAINS];
}

export function productionAuthDomains() {
  const fromEnv = process.env.PRODUCTION_AUTH_DOMAINS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((domain) => domain.trim().replace(/^https?:\/\//, ""))
      .filter(Boolean);
  }
  return [...DEFAULT_PRODUCTION_AUTH_DOMAINS];
}

/** @deprecated Use productionWranglerCustomDomains() or productionAuthDomains(). */
export function productionAppCustomDomains() {
  return productionWranglerCustomDomains();
}

export function productionAppCustomDomainRoutes() {
  return productionWranglerCustomDomains().map((domain) => ({
    pattern: domain,
    custom_domain: true,
  }));
}

export function productionAuthExtraOrigins(appUrl) {
  const primary = appUrl.replace(/\/$/, "");
  return [
    ...new Set(productionAuthDomains().map((domain) => `https://${domain}`)),
  ].filter((origin) => origin !== primary);
}

/** Paths relative to `.production-env/` where generated wrangler files live. */
const fromProductionDir = {
  schema: "../node_modules/wrangler/config-schema.json",
  appMain: "../build/server/index.js",
  appBaseDir: "../build/server",
  appAssets: "../build/client",
  pdfMain: "../workers/pdf/index.ts",
  excelMain: "../workers/excel/index.ts",
  r2HelperMain: "../scripts/r2-env-worker.js",
  fonts: "../public/fonts",
};

const PRODUCTION_FLAGS = new Set([
  "--copy-from-uat",
  "--copy-from-staging",
  "--skip-db",
  "--skip-r2",
  "--skip-build",
  "--secret-only",
  "--dry-run",
]);

export function hasProductionFlag(flag, argv = process.argv.slice(2)) {
  if (argv.includes(flag)) return true;
  const name = flag.replace(/^--/, "").replaceAll("-", "_");
  const npmVal = process.env[`npm_config_${name}`];
  return Boolean(npmVal) && npmVal !== "false";
}

export function hasFlag(flag, argv = process.argv.slice(2)) {
  return hasProductionFlag(flag, argv);
}

export function productionNames() {
  const subdomain = process.env.WORKERS_DEV_SUBDOMAIN?.trim() || "zhex900";
  const appUrl = process.env.APP_URL?.trim() || DEFAULT_PRODUCTION_APP_URL;
  return {
    label: "production",
    appWorker: PRODUCTION_APP_WORKER,
    pdfWorker: PRODUCTION_PDF_WORKER,
    excelWorker: PRODUCTION_EXCEL_WORKER,
    r2HelperWorker: PRODUCTION_R2_HELPER_WORKER,
    avatarsBucket: PRODUCTION_AVATARS_BUCKET,
    libraryBucket: PRODUCTION_LIBRARY_BUCKET,
    hyperdriveName: PRODUCTION_APP_WORKER,
    appUrl,
    r2HelperUrl: `https://${PRODUCTION_R2_HELPER_WORKER}.${subdomain}.workers.dev`,
  };
}

export function statePath() {
  return join(productionRoot, "state.json");
}

export async function loadState() {
  try {
    return JSON.parse(await readFile(statePath(), "utf8"));
  } catch {
    return null;
  }
}

export async function saveState(state) {
  await mkdir(productionRoot, { recursive: true });
  await writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function productionAppWrangler({ names, supabaseUrl, hyperdriveId }) {
  return {
    $schema: fromProductionDir.schema,
    name: names.appWorker,
    compatibility_date: "2026-07-20",
    compatibility_flags: ["nodejs_compat"],
    main: fromProductionDir.appMain,
    no_bundle: true,
    base_dir: fromProductionDir.appBaseDir,
    rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
    assets: { directory: fromProductionDir.appAssets },
    workers_dev: false,
    routes: productionAppCustomDomainRoutes(),
    observability,
    upload_source_maps: true,
    placement: { mode: "smart" },
    ...productionWorkerLimits,
    vars: {
      SUPABASE_URL: supabaseUrl,
      SESSION_INACTIVITY_TIMEOUT_MINUTES:
        process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES?.trim() || "30",
      SESSION_ABSOLUTE_TIMEOUT_HOURS:
        process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS?.trim() || "12",
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

export function productionPdfWrangler(names) {
  return {
    $schema: fromProductionDir.schema,
    name: names.pdfWorker,
    main: fromProductionDir.pdfMain,
    compatibility_date: "2026-07-20",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    preview_urls: false,
    assets: {
      directory: fromProductionDir.fonts,
      binding: "ASSETS",
      run_worker_first: true,
    },
    observability,
    ...productionWorkerLimits,
  };
}

export function productionExcelWrangler(names) {
  return {
    $schema: fromProductionDir.schema,
    name: names.excelWorker,
    compatibility_date: "2026-08-08",
    compatibility_flags: ["nodejs_compat"],
    main: fromProductionDir.excelMain,
    observability,
    ...productionWorkerLimits,
    vars: {
      WORKER_VERSION: "2.0.0",
      APP_URL: names.appUrl,
    },
    placement: { mode: "smart" },
    upload_source_maps: true,
  };
}

export function productionR2HelperWrangler(names, { emptyOnly, copyToken }) {
  const r2_buckets = emptyOnly
    ? [
        { binding: "AVATARS_DEST", bucket_name: names.avatarsBucket },
        { binding: "LIBRARY_DEST", bucket_name: names.libraryBucket },
      ]
    : [
        { binding: "AVATARS_SRC", bucket_name: UAT_AVATARS_BUCKET },
        { binding: "AVATARS_DEST", bucket_name: names.avatarsBucket },
        { binding: "LIBRARY_SRC", bucket_name: UAT_LIBRARY_BUCKET },
        { binding: "LIBRARY_DEST", bucket_name: names.libraryBucket },
      ];
  return {
    $schema: fromProductionDir.schema,
    name: names.r2HelperWorker,
    main: fromProductionDir.r2HelperMain,
    compatibility_date: "2026-07-20",
    workers_dev: true,
    vars: {
      COPY_TOKEN: copyToken,
    },
    r2_buckets,
  };
}

export async function writeProductionWranglerConfigs({
  names,
  supabaseUrl,
  hyperdriveId,
}) {
  await mkdir(productionRoot, { recursive: true });
  const appPath = join(productionRoot, "wrangler.app.jsonc");
  const pdfPath = join(productionRoot, "wrangler.pdf.jsonc");
  const excelPath = join(productionRoot, "wrangler.excel.jsonc");
  await writeJsonc(
    appPath,
    productionAppWrangler({ names, supabaseUrl, hyperdriveId }),
  );
  await writeJsonc(pdfPath, productionPdfWrangler(names));
  await writeJsonc(excelPath, productionExcelWrangler(names));
  return { appPath, pdfPath, excelPath };
}

export function extractSupabaseProjectRef(supabaseUrl) {
  const match = supabaseUrl?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function assertProductionDatabaseUrl(url) {
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Use --env-file=.env.production (see .env.production.example).",
    );
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    throw new Error(
      "DATABASE_URL points at localhost. Use the production Supabase pooler URL.",
    );
  }
  if (url.includes(UAT_PROJECT_REF)) {
    throw new Error(
      `DATABASE_URL contains UAT project ref ${UAT_PROJECT_REF}. Use the production Supabase URL.`,
    );
  }
  if (/db\.[a-z0-9]+\.supabase\.co/i.test(url)) {
    console.warn(
      "Warning: DATABASE_URL uses direct db.*.supabase.co — deploy scripts will rewrite to the pooler host (direct often fails from Docker psql). Prefer the pooler URL in .env.production.",
    );
  }
}

export function assertSafeUatCopy({
  uatDbUrl,
  prodDbUrl,
  uatSupabaseRef,
  prodSupabaseRef,
}) {
  if (!uatDbUrl?.trim()) {
    throw new Error(
      "UAT DATABASE_URL is missing. Add it to .env.uat for --copy-from-uat.",
    );
  }
  if (uatDbUrl.trim() === prodDbUrl.trim()) {
    throw new Error(
      "UAT and production DATABASE_URL are identical — refusing to copy.",
    );
  }
  if (prodDbUrl.includes(UAT_PROJECT_REF)) {
    throw new Error(
      "Production DATABASE_URL still points at UAT — refusing to copy.",
    );
  }
  if (uatSupabaseRef && prodSupabaseRef && uatSupabaseRef === prodSupabaseRef) {
    throw new Error(
      "UAT and production Supabase project refs match — refusing to copy.",
    );
  }
}

/** @deprecated Use assertSafeUatCopy */
export const assertSafeStagingCopy = assertSafeUatCopy;

export async function loadUatEnv() {
  const uatPath = join(webRoot, ".env.uat");
  let text;
  try {
    text = await readFile(uatPath, "utf8");
  } catch {
    throw new Error(
      `.env.uat not found at ${uatPath} — required for --copy-from-uat.`,
    );
  }
  const vars = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return {
    databaseUrl:
      vars.UAT_DATABASE_URL?.trim() || vars.DATABASE_URL?.trim() || "",
    supabaseUrl: vars.SUPABASE_URL?.trim() || "",
    projectRef:
      vars.UAT_SUPABASE_REF?.trim() ||
      extractSupabaseProjectRef(vars.SUPABASE_URL) ||
      UAT_PROJECT_REF,
  };
}

/** @deprecated Use loadUatEnv */
export const loadStagingEnv = loadUatEnv;

export { PRODUCTION_FLAGS };
