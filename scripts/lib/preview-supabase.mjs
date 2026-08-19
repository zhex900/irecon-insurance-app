/**
 * Shared PR Supabase project: clear DB and copy schema + data from UAT on each deploy.
 */
import { join } from "node:path";

import { copyDatabaseFromUat } from "./uat-data-copy.mjs";
import {
  extractProjectRefFromDbUrl,
  previewRoot,
  run,
  toSessionDbUrl,
  UAT_PROJECT_REF,
} from "./preview-env.mjs";
import { prSupabaseFromEnv } from "./pr-env.mjs";

const SUPABASE_API = "https://api.supabase.com/v1";

function accessToken() {
  return (
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.UAT_SUPABASE_ACCESS_TOKEN?.trim() ||
    ""
  );
}

async function supabaseApi(path, { method = "GET", body } = {}) {
  const token = accessToken();
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required to configure PR Auth URLs (https://supabase.com/dashboard/account/tokens). Add it to .env.uat or .env.pr.",
    );
  }
  const res = await fetch(`${SUPABASE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) {
    throw new Error(
      `Supabase API ${method} ${path} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`,
    );
  }
  return json;
}

export async function runPreviewMigrations(sessionUrl) {
  console.log(
    "→ Applying pending migrations to PR database (UAT baseline already synced)…",
  );
  await runDatabaseMigrations(sessionUrl, "PR");
}

export async function runUatMigrations(sessionUrl) {
  await runDatabaseMigrations(sessionUrl, "UAT");
}

async function runDatabaseMigrations(sessionUrl, target) {
  console.log(`→ Applying pending migrations to ${target} database…`);
  await run("npx", [
    "supabase",
    "db",
    "push",
    "--yes",
    "--db-url",
    toSessionDbUrl(sessionUrl),
  ]);
  console.log(`✓ ${target} migrations applied`);
}

async function copyPgsodiumKey(sourceRef, destRef) {
  try {
    const key = await supabaseApi(`/projects/${sourceRef}/pgsodium`);
    await supabaseApi(`/projects/${destRef}/pgsodium`, {
      method: "PUT",
      body: key,
    });
    console.log("✓ Copied pgsodium/Vault root key from UAT to PR");
  } catch (error) {
    console.warn(
      "Warning: could not copy pgsodium key (ok if Vault is unused).",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function configureAuthUrls({
  projectRef,
  appUrl,
  extraOrigins = [],
}) {
  const origins = [
    ...new Set([
      appUrl.replace(/\/$/, ""),
      ...extraOrigins.map((origin) => origin.replace(/\/$/, "")),
    ]),
  ];
  const allowList = [
    ...origins.flatMap((origin) => [
      origin,
      `${origin}/**`,
      `${origin}/auth/confirm`,
      `${origin}/auth/confirm/**`,
      `${origin}/reset-password`,
    ]),
    "http://127.0.0.1:5173/**",
    "http://localhost:5173/**",
  ].join(",");
  await supabaseApi(`/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    body: {
      site_url: origins[0],
      uri_allow_list: allowList,
    },
  });
  console.log("✓ PR Auth Site URL + redirect allow list →", origins.join(", "));
}

/**
 * Wipe the shared PR database and restore a full copy from UAT.
 */
export async function syncPrDatabaseFromUat({ names }) {
  const uatDbUrl = process.env.UAT_DATABASE_URL?.trim();
  if (!uatDbUrl) {
    throw new Error("UAT_DATABASE_URL is not set in .env.pr.");
  }

  const pr = prSupabaseFromEnv();
  const uatRef =
    extractProjectRefFromDbUrl(process.env.UAT_SUPABASE_URL) ||
    extractProjectRefFromDbUrl(uatDbUrl) ||
    UAT_PROJECT_REF;
  const workDir = join(previewRoot, names.label, "dump");

  console.log(
    `→ Syncing shared PR database from UAT (${uatRef} → ${pr.projectRef})…`,
  );
  await copyDatabaseFromUat({
    uatDbUrl,
    destSessionUrl: pr.sessionUrl,
    destTransactionUrl: pr.transactionUrl,
    workDir,
    skipRoles: true,
  });
  await copyPgsodiumKey(uatRef, pr.projectRef);

  return pr;
}

export async function loadPrSupabase({ names, configureAuth = true } = {}) {
  const supabase = prSupabaseFromEnv();
  if (configureAuth && accessToken()) {
    await configureAuthUrls({
      projectRef: supabase.projectRef,
      appUrl: names.appUrl,
    });
  } else if (configureAuth) {
    console.warn(
      "Warning: SUPABASE_ACCESS_TOKEN not set — skipping PR Auth URL configuration.",
    );
  }
  return supabase;
}

/** @deprecated Shared PR DB is not deleted on preview destroy. */
export async function destroySupabase() {
  console.log("→ Shared PR Supabase project left intact (not deleted)");
}

/** @deprecated Branching is not used; one shared PR project from .env.pr. */
export async function findBranchByName() {
  return null;
}

/** @deprecated Use syncPrDatabaseFromUat + loadPrSupabase. */
export async function provisionSupabase() {
  throw new Error(
    "Use syncPrDatabaseFromUat() — PR previews use .env.pr, not branching.",
  );
}

/** @deprecated Use loadPrSupabase. */
export async function loadExistingSupabase(names) {
  return loadPrSupabase({ names, configureAuth: false });
}
