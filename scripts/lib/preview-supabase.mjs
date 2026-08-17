/**
 * Create a Supabase project cloned from staging (logical dump/restore).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  captureJson,
  DEFAULT_REGION,
  previewRoot,
  randomSecret,
  run,
  sleep,
  STAGING_PROJECT_REF,
  supabaseUrls,
  toSessionDbUrl,
  webRoot,
} from "./preview-env.mjs";

const SUPABASE_API = "https://api.supabase.com/v1";

function accessToken() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required. Create one at https://supabase.com/dashboard/account/tokens",
    );
  }
  return token;
}

function stagingProjectRef() {
  return process.env.STAGING_SUPABASE_REF?.trim() || STAGING_PROJECT_REF;
}

function previewRegion() {
  return process.env.PREVIEW_REGION?.trim() || DEFAULT_REGION;
}

async function supabaseApi(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
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

export async function resolveOrgId() {
  const explicit =
    process.env.SUPABASE_ORG_ID?.trim() ||
    process.env.SUPABASE_ORG_SLUG?.trim();
  if (explicit) return explicit;
  const orgs = await captureJson("npx", [
    "supabase",
    "orgs",
    "list",
    "--output",
    "json",
  ]);
  const list = Array.isArray(orgs) ? orgs : (orgs?.organizations ?? []);
  if (list.length === 1) {
    return list[0].slug ?? list[0].id;
  }
  const names = list
    .map((org) => `${org.name ?? "?"} (${org.id ?? org.slug})`)
    .join(", ");
  throw new Error(
    `Multiple Supabase orgs found. Set SUPABASE_ORG_ID in .env.staging. Orgs: ${names || "(none)"}`,
  );
}

export async function findProjectByName(name) {
  const projects = await captureJson("npx", [
    "supabase",
    "projects",
    "list",
    "--output",
    "json",
  ]);
  const list = Array.isArray(projects) ? projects : [];
  return list.find((project) => project.name === name) ?? null;
}

async function waitUntilHealthy(
  projectRef,
  { timeoutMs = 10 * 60 * 1000 } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const project = await supabaseApi(`/projects/${projectRef}`);
      const status = project?.status ?? "";
      if (status === "ACTIVE_HEALTHY") return project;
      console.log(`  … project ${projectRef} status ${status || "unknown"}`);
    } catch (error) {
      console.log(
        `  … waiting for project ${projectRef}: ${error instanceof Error ? error.message : error}`,
      );
    }
    await sleep(10_000);
  }
  throw new Error(
    `Timed out waiting for Supabase project ${projectRef} to become ACTIVE_HEALTHY`,
  );
}

export async function getProjectApiKeys(projectRef) {
  const keys = await captureJson("npx", [
    "supabase",
    "projects",
    "api-keys",
    "--project-ref",
    projectRef,
    "--reveal",
    "--output",
    "json",
  ]);
  const list = Array.isArray(keys) ? keys : [];
  const pick = (...names) =>
    list.find((key) => names.includes(key.name) || names.includes(key.type))
      ?.api_key ??
    list.find((key) => names.includes(key.name) || names.includes(key.type))
      ?.apiKey ??
    null;

  const anon = pick("anon", "publishable");
  const serviceRole = pick("service_role", "secret");
  if (!anon) {
    throw new Error(
      `Could not read anon/publishable key for ${projectRef}. Got: ${JSON.stringify(list.map((k) => k.name ?? k.type))}`,
    );
  }
  if (!serviceRole) {
    throw new Error(
      `Could not read service_role/secret key for ${projectRef}.`,
    );
  }
  return { anon, serviceRole };
}

async function copyPgsodiumKey(sourceRef, destRef) {
  try {
    const key = await supabaseApi(`/projects/${sourceRef}/pgsodium`);
    await supabaseApi(`/projects/${destRef}/pgsodium`, {
      method: "PUT",
      body: key,
    });
    console.log("✓ Copied pgsodium/Vault root key from staging");
  } catch (error) {
    console.warn(
      "Warning: could not copy pgsodium key (ok if Vault is unused).",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function configureAuthUrls({ projectRef, appUrl }) {
  const origin = appUrl.replace(/\/$/, "");
  const allowList = [
    origin,
    `${origin}/**`,
    `${origin}/auth/confirm`,
    `${origin}/auth/confirm/**`,
    `${origin}/reset-password`,
    "http://127.0.0.1:5173/**",
    "http://localhost:5173/**",
  ].join(",");
  await supabaseApi(`/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    body: {
      site_url: origin,
      uri_allow_list: allowList,
    },
  });
  console.log("✓ Auth Site URL + redirect allow list →", origin);
}

async function runPsqlScript(dbUrl, file) {
  const args = [
    "--variable",
    "ON_ERROR_STOP=1",
    "--file",
    file,
    "--dbname",
    dbUrl,
  ];
  try {
    await run("psql", args);
    return;
  } catch (error) {
    if (error instanceof Error && !/psql/.test(error.message)) throw error;
    console.log("psql not on PATH — running via Docker postgres:17-alpine…");
  }

  const mountDir = dirname(file);
  const dockerFile = `/sql/${file.slice(mountDir.length + 1)}`;
  await run("docker", [
    "run",
    "--rm",
    "-v",
    `${mountDir}:/sql:ro`,
    "postgres:17-alpine",
    "psql",
    "--variable",
    "ON_ERROR_STOP=1",
    "--file",
    dockerFile,
    "--dbname",
    dbUrl,
  ]);
}

async function runPsqlScriptWithRetry(dbUrl, file, { attempts = 6 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      await runPsqlScript(dbUrl, file);
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!/EMAXCONNSESSION|max clients reached/i.test(msg) || i === attempts - 1) {
        throw error;
      }
      const waitMs = 10_000 * (i + 1);
      console.log(`  … session pooler full, retrying in ${waitMs / 1000}s…`);
      await sleep(waitMs);
    }
  }
}

const RESET_PREVIEW_DB_SQL = `
SET statement_timeout = 0;
SET lock_timeout = 0;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO service_role;
TRUNCATE auth.users CASCADE;
TRUNCATE storage.objects CASCADE;
`.trim();

async function resetPreviewDatabase(dbUrl, workDir) {
  await mkdir(workDir, { recursive: true });
  const sqlPath = join(workDir, "reset.sql");
  await writeFile(sqlPath, `${RESET_PREVIEW_DB_SQL}\n`, "utf8");
  console.log(
    "→ Resetting preview database (drop public schema, truncate auth/storage)…",
  );
  await runPsqlScriptWithRetry(dbUrl, sqlPath);
}

async function restoreWithPsql(destUrl, dumpDir, { skipRoles = false } = {}) {
  const localArgs = [
    "--single-transaction",
    "--variable",
    "ON_ERROR_STOP=1",
  ];
  if (!skipRoles) {
    localArgs.push("--file", join(dumpDir, "roles.sql"));
  }
  localArgs.push(
    "--file",
    join(dumpDir, "schema.sql"),
    "--command",
    "SET session_replication_role = replica",
    "--file",
    join(dumpDir, "data.sql"),
    "--dbname",
    destUrl,
  );
  try {
    await run("psql", localArgs);
    return;
  } catch (error) {
    if (error instanceof Error && !/psql/.test(error.message)) throw error;
    console.log("psql not on PATH — restoring via Docker postgres:17-alpine…");
  }
  await run("docker", [
    "run",
    "--rm",
    "-v",
    `${dumpDir}:/dump`,
    "postgres:17-alpine",
    "psql",
    "--single-transaction",
    "--variable",
    "ON_ERROR_STOP=1",
    ...(skipRoles ? [] : ["--file", "/dump/roles.sql"]),
    "--file",
    "/dump/schema.sql",
    "--command",
    "SET session_replication_role = replica",
    "--file",
    "/dump/data.sql",
    "--dbname",
    destUrl,
  ]);
}

async function dumpStaging(dumpDir, stagingDbUrl) {
  const dbUrl = toSessionDbUrl(stagingDbUrl);
  await mkdir(dumpDir, { recursive: true });
  console.log("→ Dumping staging database (roles, schema, data)…");
  await run("npx", [
    "supabase",
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "-f",
    join(dumpDir, "roles.sql"),
    "--role-only",
  ]);
  await run("npx", [
    "supabase",
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "-f",
    join(dumpDir, "schema.sql"),
  ]);
  await run("npx", [
    "supabase",
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "-f",
    join(dumpDir, "data.sql"),
    "--use-copy",
    "--data-only",
    "-x",
    "storage.buckets_vectors",
    "-x",
    "storage.vector_indexes",
  ]);
  console.log("✓ Staging dump written to", dumpDir);
}

async function loadSavedPassword(slug) {
  const fromEnv = process.env.PREVIEW_DB_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  try {
    const saved = (
      await readFile(join(previewRoot, slug, ".db-password"), "utf8")
    ).trim();
    return saved || null;
  } catch {
    return null;
  }
}

async function savePassword(slug, password) {
  await mkdir(join(previewRoot, slug), { recursive: true });
  await writeFile(
    join(previewRoot, slug, ".db-password"),
    `${password}\n`,
    "utf8",
  );
}

async function createSupabaseProject({ names, password, region }) {
  const orgId = await resolveOrgId();
  const size = process.env.PREVIEW_DB_SIZE?.trim();
  console.log(
    `→ Creating Supabase project ${names.supabaseName} (${region}${size ? `, ${size}` : ", default compute"})…`,
  );
  const createArgs = [
    "supabase",
    "projects",
    "create",
    names.supabaseName,
    "--org-id",
    orgId,
    "--db-password",
    password,
    "--region",
    region,
    "--output",
    "json",
  ];
  if (size) {
    createArgs.push("--size", size);
  }
  const createdProject = await captureJson("npx", createArgs);
  const projectRef = createdProject.id ?? createdProject.ref;
  if (!projectRef) {
    throw new Error(
      `Could not read project ref from create response: ${JSON.stringify(createdProject)}`,
    );
  }
  console.log(`✓ Created Supabase project ${projectRef}`);
  return projectRef;
}

export async function provisionSupabase({ names }) {
  const region = previewRegion();
  const existing = await findProjectByName(names.supabaseName);
  let projectRef;
  let password;
  let created = false;

  if (existing?.id || existing?.ref) {
    projectRef = existing.id ?? existing.ref;
    password = await loadSavedPassword(names.label);
    if (!password) {
      throw new Error(
        `Supabase project "${names.supabaseName}" already exists (${projectRef}). ` +
          "Re-run with PREVIEW_DB_PASSWORD set to that project's DB password, or destroy the env first.",
      );
    }
    console.log(
      `→ Reusing Supabase project ${projectRef} (${names.supabaseName})`,
    );
  } else {
    password = process.env.PREVIEW_DB_PASSWORD?.trim() || randomSecret(24);
    projectRef = await createSupabaseProject({ names, password, region });
    created = true;
  }

  await savePassword(names.label, password);
  await waitUntilHealthy(projectRef);
  const urls = supabaseUrls({ projectRef, password, region });

  const stagingDbUrl = process.env.DATABASE_URL?.trim();
  if (!stagingDbUrl) {
    throw new Error(
      "DATABASE_URL (staging pooler/direct URL) is required to copy the database.",
    );
  }
  const dumpDir = join(previewRoot, names.label, "dump");
  console.log(
    created
      ? "→ Copying staging database into new preview project…"
      : "→ Refreshing preview database from staging…",
  );
  await dumpStaging(dumpDir, stagingDbUrl);
  if (!created) {
    await resetPreviewDatabase(urls.sessionUrl, dumpDir);
  }
  // Restore via transaction pooler (6543): session pooler is capped (~15) and Hyperdrive
  // holds those slots; direct (db.*.supabase.co) is IPv6-only and fails from Docker on macOS.
  const adminDbUrl = urls.transactionUrl;
  console.log("→ Restoring dump into preview project…");
  await restoreWithPsql(adminDbUrl, dumpDir, { skipRoles: !created });
  console.log("✓ Database copied from staging");
  await copyPgsodiumKey(stagingProjectRef(), projectRef);

  const keys = await getProjectApiKeys(projectRef);
  await configureAuthUrls({ projectRef, appUrl: names.appUrl });

  return {
    projectRef,
    password,
    region,
    created,
    ...urls,
    anonKey: keys.anon,
    serviceRoleKey: keys.serviceRole,
  };
}

export async function loadExistingSupabase(names) {
  const region = previewRegion();
  const existing = await findProjectByName(names.supabaseName);
  const projectRef = existing?.id ?? existing?.ref;
  if (!projectRef) {
    throw new Error(
      `No Supabase project named "${names.supabaseName}". Run a full deploy first (omit --skip-db).`,
    );
  }
  const password = await loadSavedPassword(names.label);
  if (!password) {
    throw new Error(
      `Missing DB password for ${projectRef}. Set PREVIEW_DB_PASSWORD or re-run a full deploy.`,
    );
  }
  const urls = supabaseUrls({ projectRef, password, region });
  const keys = await getProjectApiKeys(projectRef);
  return {
    projectRef,
    password,
    region,
    created: false,
    ...urls,
    anonKey: keys.anon,
    serviceRoleKey: keys.serviceRole,
  };
}

export async function destroySupabase(projectRef) {
  if (!projectRef) return;
  if (projectRef === stagingProjectRef()) {
    throw new Error("Refusing to delete the staging Supabase project.");
  }
  console.log(`→ Deleting Supabase project ${projectRef}…`);
  await run("npx", ["supabase", "projects", "delete", projectRef, "--yes"], {
    cwd: webRoot,
  });
  console.log("✓ Supabase project deleted");
}
