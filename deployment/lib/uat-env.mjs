/**
 * UAT deploy env — same Supabase repair/normalization as PR deploy.
 */
import { join } from "node:path";

import {
  UAT_APP_URL,
  UAT_APP_WORKER,
  UAT_AVATARS_BUCKET,
  UAT_EXCEL_WORKER,
  UAT_HYPERDRIVE_ID,
  UAT_HYPERDRIVE_NAME,
  UAT_LIBRARY_BUCKET,
  UAT_PDF_WORKER,
  UAT_PROJECT_REF,
} from "./constants.mjs";
import {
  extractProjectRefFromDbUrl,
  repairSupabaseDatabaseUrl,
  toSessionDbUrl,
  toTransactionDbUrl,
  webRoot,
} from "./preview-env.mjs";
import { applyEnvFile, readEnvFile } from "./pr-env.mjs";

export { UAT_APP_URL, UAT_HYPERDRIVE_ID };

export function uatNames() {
  const appUrl = process.env.APP_URL?.trim() || UAT_APP_URL;
  return {
    label: "uat",
    slug: "uat",
    appWorker: UAT_APP_WORKER,
    pdfWorker: UAT_PDF_WORKER,
    excelWorker: UAT_EXCEL_WORKER,
    avatarsBucket: UAT_AVATARS_BUCKET,
    libraryBucket: UAT_LIBRARY_BUCKET,
    hyperdriveName: UAT_HYPERDRIVE_NAME,
    appUrl,
  };
}

export async function loadUatDeployEnv() {
  const uatPath = join(webRoot, ".env.uat");
  const uatEnv = await readEnvFile(".env.uat");

  if (!uatEnv.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is required in .env.uat (Supabase pooler URL).",
    );
  }
  if (!uatEnv.SUPABASE_URL?.trim()) {
    throw new Error("SUPABASE_URL is required in .env.uat.");
  }
  if (!uatEnv.SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is required in .env.uat.");
  }
  if (!uatEnv.SUPABASE_SECRET_KEY?.trim()) {
    throw new Error("SUPABASE_SECRET_KEY is required in .env.uat.");
  }

  applyEnvFile(uatEnv);
  process.env.WRANGLER_ENV_FILE = uatPath;

  process.env.DATABASE_URL = repairSupabaseDatabaseUrl(
    uatEnv.DATABASE_URL,
    uatEnv.SUPABASE_URL,
  );

  const url = process.env.DATABASE_URL;
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    throw new Error(
      "DATABASE_URL points at localhost. Use the UAT Supabase pooler URL in .env.uat.",
    );
  }
}

export function uatSupabaseFromEnv() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!databaseUrl || !supabaseUrl || !publishableKey || !secretKey) {
    throw new Error(
      "UAT Supabase env incomplete in .env.uat (DATABASE_URL, SUPABASE_URL, keys).",
    );
  }

  const projectRef =
    extractProjectRefFromDbUrl(supabaseUrl) ||
    extractProjectRefFromDbUrl(databaseUrl) ||
    UAT_PROJECT_REF;

  return {
    projectRef,
    supabaseUrl,
    sessionUrl: toSessionDbUrl(databaseUrl),
    transactionUrl: toTransactionDbUrl(databaseUrl),
    publishableKey,
    secretKey,
  };
}
