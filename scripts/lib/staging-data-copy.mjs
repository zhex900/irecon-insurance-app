/**
 * Dump staging Postgres and restore into another Supabase project.
 * Used by preview provisioning and production `--copy-from-staging`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { run, sleep, toSessionDbUrl } from "./preview-env.mjs";

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
      if (!/EMAXCONNSESSION|max clients reached/i.test(msg) || i === attempts - 1) {
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

export async function restoreWithPsql(destUrl, dumpDir, { skipRoles = false } = {}) {
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

export async function dumpStagingDatabase(dumpDir, stagingDbUrl) {
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

/**
 * Replace target DB contents with a logical copy of staging.
 * @param {object} options
 * @param {string} options.stagingDbUrl
 * @param {string} options.destSessionUrl — session pooler (5432) for reset
 * @param {string} options.destTransactionUrl — transaction pooler (6543) for restore
 * @param {string} options.workDir — dump + reset SQL directory
 * @param {boolean} [options.skipRoles=true] — skip roles.sql on existing projects
 */
export async function copyDatabaseFromStaging({
  stagingDbUrl,
  destSessionUrl,
  destTransactionUrl,
  workDir,
  skipRoles = true,
}) {
  await dumpStagingDatabase(workDir, stagingDbUrl);
  await resetTargetDatabase(destSessionUrl, workDir);
  console.log("→ Restoring staging dump into target project…");
  await restoreWithPsql(destTransactionUrl, workDir, { skipRoles });
  console.log("✓ Database copied from staging");
}
