/**
 * Production deploy helpers (Workers, R2, Hyperdrive, generated wrangler configs).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import {
  DEFAULT_PRODUCTION_APP_URL,
  DEFAULT_PRODUCTION_AUTH_DOMAINS,
  DEFAULT_PRODUCTION_WRANGLER_CUSTOM_DOMAINS,
  DEFAULT_SESSION_ABSOLUTE_TIMEOUT_HOURS,
  DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES,
  EXCEL_WORKER_VERSION,
  PRODUCTION_APP_WORKER,
  PRODUCTION_AVATARS_BUCKET,
  PRODUCTION_EXCEL_WORKER,
  PRODUCTION_LIBRARY_BUCKET,
  PRODUCTION_PDF_WORKER,
  PRODUCTION_SCRIPT_FLAGS,
  PRODUCTION_WRANGLER_PATHS,
  UAT_PROJECT_REF,
  WORKER_CPU_MS,
  WRANGLER_APP_COMPATIBILITY_DATE,
  WRANGLER_COMPATIBILITY_FLAGS,
  WRANGLER_EXCEL_COMPATIBILITY_DATE,
  workerCpuLimits,
  observability,
} from "./constants.mjs";
import { webRoot, writeJsonc } from "./preview-env.mjs";

export const productionRoot = join(webRoot, ".production-env");

export {
  DEFAULT_PRODUCTION_APP_URL,
  DEFAULT_PRODUCTION_AUTH_DOMAINS,
  DEFAULT_PRODUCTION_WRANGLER_CUSTOM_DOMAINS,
  PRODUCTION_APP_WORKER,
  PRODUCTION_AVATARS_BUCKET,
  PRODUCTION_EXCEL_WORKER,
  PRODUCTION_LIBRARY_BUCKET,
  PRODUCTION_PDF_WORKER,
  WORKER_CPU_MS as PRODUCTION_CPU_MS,
};

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
  const appUrl = process.env.APP_URL?.trim() || DEFAULT_PRODUCTION_APP_URL;
  return {
    label: "production",
    appWorker: PRODUCTION_APP_WORKER,
    pdfWorker: PRODUCTION_PDF_WORKER,
    excelWorker: PRODUCTION_EXCEL_WORKER,
    avatarsBucket: PRODUCTION_AVATARS_BUCKET,
    libraryBucket: PRODUCTION_LIBRARY_BUCKET,
    hyperdriveName: PRODUCTION_APP_WORKER,
    appUrl,
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
    $schema: PRODUCTION_WRANGLER_PATHS.schema,
    name: names.appWorker,
    compatibility_date: WRANGLER_APP_COMPATIBILITY_DATE,
    compatibility_flags: WRANGLER_COMPATIBILITY_FLAGS,
    main: PRODUCTION_WRANGLER_PATHS.appMain,
    no_bundle: true,
    base_dir: PRODUCTION_WRANGLER_PATHS.appBaseDir,
    rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
    assets: { directory: PRODUCTION_WRANGLER_PATHS.appAssets },
    workers_dev: false,
    routes: productionAppCustomDomainRoutes(),
    observability,
    upload_source_maps: true,
    placement: { mode: "smart" },
    ...workerCpuLimits,
    vars: {
      SUPABASE_URL: supabaseUrl,
      SESSION_INACTIVITY_TIMEOUT_MINUTES:
        process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES?.trim() ||
        DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES,
      SESSION_ABSOLUTE_TIMEOUT_HOURS:
        process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS?.trim() ||
        DEFAULT_SESSION_ABSOLUTE_TIMEOUT_HOURS,
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
    $schema: PRODUCTION_WRANGLER_PATHS.schema,
    name: names.pdfWorker,
    main: PRODUCTION_WRANGLER_PATHS.pdfMain,
    compatibility_date: WRANGLER_APP_COMPATIBILITY_DATE,
    compatibility_flags: WRANGLER_COMPATIBILITY_FLAGS,
    workers_dev: false,
    preview_urls: false,
    assets: {
      directory: PRODUCTION_WRANGLER_PATHS.fonts,
      binding: "ASSETS",
      run_worker_first: true,
    },
    observability,
    ...workerCpuLimits,
  };
}

export function productionExcelWrangler(names) {
  return {
    $schema: PRODUCTION_WRANGLER_PATHS.schema,
    name: names.excelWorker,
    compatibility_date: WRANGLER_EXCEL_COMPATIBILITY_DATE,
    compatibility_flags: WRANGLER_COMPATIBILITY_FLAGS,
    main: PRODUCTION_WRANGLER_PATHS.excelMain,
    observability,
    ...workerCpuLimits,
    vars: {
      WORKER_VERSION: EXCEL_WORKER_VERSION,
      APP_URL: names.appUrl,
    },
    placement: { mode: "smart" },
    upload_source_maps: true,
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
    throw new Error("UAT DATABASE_URL is missing. Add it to .env.uat.");
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

export async function loadUatEnv() {
  const uatPath = join(webRoot, ".env.uat");
  let text;
  try {
    text = await readFile(uatPath, "utf8");
  } catch {
    throw new Error(`.env.uat not found at ${uatPath}.`);
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

/** @deprecated Use PRODUCTION_SCRIPT_FLAGS */
export { PRODUCTION_SCRIPT_FLAGS as PRODUCTION_FLAGS };
