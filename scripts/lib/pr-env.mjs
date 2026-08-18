/**
 * Load `.env.pr` for preview deploys (single source — not `.env.uat`).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  extractProjectRefFromDbUrl,
  repairSupabaseDatabaseUrl,
  toSessionDbUrl,
  toTransactionDbUrl,
  UAT_PROJECT_REF,
  webRoot,
} from "./preview-env.mjs";

export function parseEnvFile(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function applyEnvFile(env) {
  Object.assign(process.env, env);
}

export async function readEnvFile(relativePath) {
  const path = join(webRoot, relativePath);
  try {
    return parseEnvFile(await readFile(path, "utf8"));
  } catch {
    throw new Error(`Missing ${path}.`);
  }
}

export async function loadPrDeployEnv() {
  const prPath = join(webRoot, ".env.pr");
  let prText;
  try {
    prText = await readFile(prPath, "utf8");
  } catch {
    throw new Error(`Missing ${prPath}. Copy from .env.pr.example.`);
  }

  const prEnv = parseEnvFile(prText);

  if (!prEnv.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required in .env.pr (shared PR database).");
  }
  if (!prEnv.UAT_DATABASE_URL?.trim()) {
    throw new Error(
      "UAT_DATABASE_URL is required in .env.pr (UAT copy source for PR deploy).",
    );
  }
  if (!prEnv.SUPABASE_URL?.trim()) {
    throw new Error("SUPABASE_URL is required in .env.pr.");
  }
  if (!prEnv.SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is required in .env.pr.");
  }
  if (!prEnv.SUPABASE_SECRET_KEY?.trim()) {
    throw new Error("SUPABASE_SECRET_KEY is required in .env.pr.");
  }

  const uatSupabaseUrl =
    prEnv.UAT_SUPABASE_URL?.trim() ||
    (extractProjectRefFromDbUrl(prEnv.UAT_DATABASE_URL)
      ? `https://${extractProjectRefFromDbUrl(prEnv.UAT_DATABASE_URL)}.supabase.co`
      : "");

  const prRef = extractProjectRefFromDbUrl(prEnv.SUPABASE_URL);
  const uatRef =
    extractProjectRefFromDbUrl(uatSupabaseUrl) ||
    extractProjectRefFromDbUrl(prEnv.UAT_DATABASE_URL);

  if (prRef && uatRef && prRef === uatRef) {
    throw new Error(
      `PR Supabase project ref (${prRef}) matches UAT. Use separate projects in .env.pr.`,
    );
  }

  applyEnvFile(prEnv);

  process.env.DATABASE_URL = repairSupabaseDatabaseUrl(
    prEnv.DATABASE_URL,
    prEnv.SUPABASE_URL,
  );
  process.env.UAT_DATABASE_URL = repairSupabaseDatabaseUrl(
    prEnv.UAT_DATABASE_URL,
    uatSupabaseUrl,
  );

  delete process.env.APP_URL;
  if (prEnv.BASE_URL?.trim()) {
    process.env.BASE_URL = prEnv.BASE_URL.trim();
  }

  process.env.WRANGLER_ENV_FILE = prPath;
}

export function prSupabaseFromEnv() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!databaseUrl || !supabaseUrl || !publishableKey || !secretKey) {
    throw new Error(
      "PR Supabase env incomplete in .env.pr (DATABASE_URL, SUPABASE_URL, keys).",
    );
  }

  const projectRef = extractProjectRefFromDbUrl(supabaseUrl);
  if (!projectRef) {
    throw new Error(`Could not parse project ref from SUPABASE_URL: ${supabaseUrl}`);
  }
  if (projectRef === UAT_PROJECT_REF) {
    throw new Error(
      "SUPABASE_URL in .env.pr points at UAT. Use the dedicated PR Supabase project.",
    );
  }

  return {
    projectRef,
    supabaseUrl,
    sessionUrl: toSessionDbUrl(databaseUrl),
    transactionUrl: toTransactionDbUrl(databaseUrl),
    publishableKey,
    secretKey,
  };
}
