/**
 * Dump UAT Postgres and restore into another Supabase project.
 * Manual / one-off tooling — not part of `npm run deploy:prod`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { capture, run, sleep, toSessionDbUrl } from "./preview-env.mjs";

const RESET_TARGET_DB_SQL = `
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
      if (
        !/EMAXCONNSESSION|max clients reached/i.test(msg) ||
        i === attempts - 1
      ) {
        throw error;
      }
      const waitMs = 10_000 * (i + 1);
      console.log(`  … session pooler full, retrying in ${waitMs / 1000}s…`);
      await sleep(waitMs);
    }
  }
}

export async function resetTargetDatabase(dbUrl, workDir) {
  await mkdir(workDir, { recursive: true });
  const sqlPath = join(workDir, "reset.sql");
  await writeFile(sqlPath, `${RESET_TARGET_DB_SQL}\n`, "utf8");
  console.log(
    "→ Resetting target database (drop public schema, truncate auth/storage)…",
  );
  await runPsqlScriptWithRetry(dbUrl, sqlPath);
}

export async function restoreWithPsql(
  destUrl,
  dumpDir,
  { skipRoles = false } = {},
) {
  const localArgs = ["--single-transaction", "--variable", "ON_ERROR_STOP=1"];
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

export async function dumpUatDatabase(dumpDir, uatDbUrl) {
  const dbUrl = toSessionDbUrl(uatDbUrl);
  await mkdir(dumpDir, { recursive: true });
  console.log("→ Dumping UAT database (roles, schema, data)…");
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
  console.log("✓ UAT dump written to", dumpDir);
}

async function querySql(dbUrl, sql) {
  const args = ["-t", "-A", "--dbname", dbUrl, "-c", sql];
  try {
    const { stdout } = await capture("psql", args, { silent: true });
    return stdout.trim();
  } catch (error) {
    if (error instanceof Error && !/psql/.test(error.message)) throw error;
  }
  const { stdout } = await capture(
    "docker",
    ["run", "--rm", "postgres:17-alpine", "psql", ...args],
    { silent: true },
  );
  return stdout.trim();
}

/**
 * Copy UAT migration history so `supabase db push` only runs migrations newer than UAT.
 * Uses version IDs + `supabase migration repair` because UAT/PR schema_migrations columns differ.
 */
export async function syncMigrationHistoryFromUat({
  uatDbUrl,
  destSessionUrl,
  workDir,
}) {
  const uatSession = toSessionDbUrl(uatDbUrl);
  const destSession = toSessionDbUrl(destSessionUrl);
  const truncateFile = join(workDir, "truncate_migrations.sql");

  console.log("→ Syncing Supabase migration history from UAT…");

  let versions;
  try {
    const raw = await querySql(
      uatSession,
      "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;",
    );
    versions = raw
      .split("\n")
      .map((version) => version.trim())
      .filter(Boolean);
  } catch (error) {
    console.warn(
      "Warning: could not read UAT migration history — PR db push may re-apply UAT migrations.",
      error instanceof Error ? error.message : error,
    );
    return;
  }

  if (versions.length === 0) {
    console.warn("Warning: UAT migration history is empty.");
    return;
  }

  await writeFile(
    truncateFile,
    "TRUNCATE supabase_migrations.schema_migrations;\n",
    "utf8",
  );
  await runPsqlScriptWithRetry(destSession, truncateFile);

  const chunkSize = 20;
  for (let i = 0; i < versions.length; i += chunkSize) {
    const chunk = versions.slice(i, i + chunkSize);
    await run("npx", [
      "supabase",
      "migration",
      "repair",
      "--status",
      "applied",
      "--db-url",
      destSession,
      ...chunk,
    ]);
  }

  console.log(`✓ Migration history synced from UAT (${versions.length} versions)`);
}

/**
 * Replace target DB contents with a logical copy of UAT.
 */
export async function copyDatabaseFromUat({
  uatDbUrl,
  destSessionUrl,
  destTransactionUrl,
  workDir,
  skipRoles = true,
}) {
  await dumpUatDatabase(workDir, uatDbUrl);
  await resetTargetDatabase(destSessionUrl, workDir);
  console.log("→ Restoring UAT dump into target project…");
  await restoreWithPsql(destTransactionUrl, workDir, { skipRoles });
  await syncMigrationHistoryFromUat({
    uatDbUrl,
    destSessionUrl,
    workDir,
  });
  console.log("✓ Database copied from UAT");
}
