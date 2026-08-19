/**
 * Migrate legacy MSSQL domain data → Postgres (documents/R2 are separate).
 *
 * Target scope: CAR policies with InceptionDate >= 2025-06-01 (see scripts/sql/legacy/_target-scope.sql).
 * Clients, documents, notes, and wordings are limited to that policy set.
 *
 * Default load: account-managers, AR, clients, policies (no R2).
 * Documents: npm run db:migrate:legacy:documents:uat (or --only documents).
 *
 * Usage (from repo root):
 *   npm run db:migrate:legacy -- --env=local --dry-run
 *   npm run db:migrate:legacy -- --env=uat --confirm --replace
 *   npm run db:migrate:legacy:documents:uat
 *
 * Options:
 *   --env=local|uat|pr|prod   Target Postgres (required)
 *   --dry-run                 Export + print counts; do not write Postgres/R2
 *   --write-json [path]       Also write export snapshot
 *   --file <path>             Load export snapshot instead of querying MSSQL
 *   --only <slices>           Comma-separated: account-managers,ar,clients,policies,documents
 *   --replace                 Truncate target tables before load (per slice)
 *   --skip-r2                 Skip R2 upload (metadata only)
 *   --missing-csv [path]      Write missing PDF paths to CSV (default: _archive/data/legacy-documents-missing.csv)
 *   --no-missing-csv          Do not write missing-documents CSV
 *   --clear-documents         Remove migrated documents (Postgres + R2 + checkpoint) before upload
 *   --no-resume               Ignore checkpoint and re-process every document row
 *   --sync-state [path]       Checkpoint file (default: _archive/data/legacy-documents-sync-state.json)
 *   --default-ar <id>         Fallback AR when client row has no mapping
 *   --confirm                 Required for uat, pr, and prod
 *   --sql <slice> <path>      Override SQL for a slice (see scripts/sql/legacy/)
 *
 * MSSQL: MSSQL_* in .env (or _archive/mssql/.env.mssql)
 * Documents: POLICY_DOCUMENT_PATHS or POLICY_DOCUMENT_PATH (local folder(s) of legacy PDFs)
 * R2: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resetSharedDbPool } from "../app/lib/db/client";
import { exportLegacyDomain } from "./export-legacy-domain.mts";
import {
  DEFAULT_DB_SLICES,
  loadLegacyDomain,
  parseOnlySlices,
} from "./lib/load-legacy-domain.mts";
import { loadLegacyEnvFile } from "./lib/legacy-mssql.mts";
import {
  assertMigrateConfirmed,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
} from "./lib/migrate-target-env.mts";
import { applyEnvFile, readEnvFile } from "../infra/lib/pr-env.mjs";
import type { LegacyDomainPayload } from "./lib/legacy-payload.ts";
import { logMigrationScopeCounts } from "./lib/legacy-migration-scope.mts";
import { parseSqlOverrides } from "./lib/legacy-sql.mts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_JSON = join(repoRoot, "_archive/data/legacy-export.json");
const DEFAULT_MISSING_CSV = join(
  repoRoot,
  "_archive/data/legacy-documents-missing.csv",
);

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseArgs(argv: string[]) {
  let writeJson: string | null = null;
  let readJson: string | null = null;
  let dryRun = false;
  let replace = false;
  let skipR2 = false;
  let confirm = readFlag("--confirm");
  let only: string | undefined;
  let defaultAr: number | null = null;
  let missingCsv: string | undefined = DEFAULT_MISSING_CSV;
  let noMissingCsv = false;
  let clearDocuments = false;
  let resumeDocuments = true;
  let syncState: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--replace") {
      replace = true;
      continue;
    }
    if (arg === "--skip-r2") {
      skipR2 = true;
      continue;
    }
    if (arg === "--no-missing-csv") {
      noMissingCsv = true;
      continue;
    }
    if (arg === "--clear-documents") {
      clearDocuments = true;
      resumeDocuments = false;
      continue;
    }
    if (arg === "--no-resume") {
      resumeDocuments = false;
      continue;
    }
    if (arg === "--sync-state") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        syncState = isAbsolute(next) ? next : resolve(process.cwd(), next);
        i += 1;
      }
      continue;
    }
    if (arg === "--missing-csv") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        missingCsv = isAbsolute(next) ? next : resolve(process.cwd(), next);
        i += 1;
      } else {
        missingCsv = DEFAULT_MISSING_CSV;
      }
      continue;
    }
    if (arg === "--only") {
      only = argv[++i];
      continue;
    }
    if (arg === "--default-ar") {
      const next = argv[++i];
      if (next && /^\d+$/.test(next)) defaultAr = Number(next);
      continue;
    }
    if (arg === "--write-json") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        writeJson = isAbsolute(next) ? next : resolve(process.cwd(), next);
        i += 1;
      } else {
        writeJson = DEFAULT_JSON;
      }
      continue;
    }
    if (arg === "--file") {
      const next = argv[++i];
      if (next)
        readJson = isAbsolute(next) ? next : resolve(process.cwd(), next);
    }
  }

  return {
    writeJson,
    readJson,
    dryRun,
    replace,
    skipR2,
    confirm,
    only: parseOnlySlices(only),
    defaultAr,
    sqlOverrides: parseSqlOverrides(argv),
    missingCsv: noMissingCsv ? undefined : missingCsv,
    clearDocuments,
    resumeDocuments,
    syncStatePath: syncState,
  };
}

function effectiveSlices(only: ReturnType<typeof parseOnlySlices>) {
  return only?.length ? only : DEFAULT_DB_SLICES;
}

function includesDocumentsSlice(only: ReturnType<typeof parseOnlySlices>) {
  return effectiveSlices(only).includes("documents");
}

async function main() {
  const targetEnv = parseMigrateTargetEnv();
  if (!targetEnv) {
    console.error(missingMigrateEnvHelp());
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  // MSSQL + local document paths always come from .env (source machine).
  const localEnv = await readEnvFile(".env");
  applyEnvFile(localEnv);
  loadLegacyEnvFile();

  const databaseUrl = await loadMigrateTargetEnv(targetEnv);
  logMigrateTarget(targetEnv, databaseUrl);
  await resetSharedDbPool();

  let payload: LegacyDomainPayload;
  if (args.readJson) {
    if (!existsSync(args.readJson)) {
      throw new Error(`Export file not found: ${args.readJson}`);
    }
    payload = JSON.parse(
      readFileSync(args.readJson, "utf8"),
    ) as LegacyDomainPayload;
    console.log(`Loaded export snapshot ${args.readJson}`);
  } else {
    console.log("1/2 Exporting legacy domain from MSSQL…");
    payload = await exportLegacyDomain({ sqlOverrides: args.sqlOverrides });
  }

  logMigrationScopeCounts(payload);

  if (args.writeJson && !args.readJson) {
    mkdirSync(dirname(args.writeJson), { recursive: true });
    writeFileSync(
      args.writeJson,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
    console.log(`  wrote snapshot ${args.writeJson}`);
  }

  const exportPath = args.readJson ?? DEFAULT_JSON;

  if (args.dryRun) {
    const stats = await loadLegacyDomain({
      data: payload,
      only: args.only,
      replace: args.replace,
      dryRun: true,
      skipR2: args.skipR2,
      defaultArId: args.defaultAr,
      missingDocumentsCsv: includesDocumentsSlice(args.only)
        ? args.missingCsv
        : undefined,
      clearDocuments: args.clearDocuments,
      resumeDocuments: args.resumeDocuments,
      syncStatePath: args.syncStatePath,
      targetEnv,
      exportPath,
    });
    console.log("Dry run — skipped Postgres/R2.", stats);
    await resetSharedDbPool();
    return;
  }

  assertMigrateConfirmed(targetEnv, args.confirm);

  const slices = effectiveSlices(args.only);
  console.log(
    slices.includes("documents")
      ? "2/2 Loading documents (Postgres + R2)…"
      : "2/2 Loading into Postgres…",
  );
  const stats = await loadLegacyDomain({
    data: payload,
    only: args.only,
    replace: args.replace,
    skipR2: args.skipR2,
    defaultArId: args.defaultAr,
    missingDocumentsCsv: includesDocumentsSlice(args.only)
      ? args.missingCsv
      : undefined,
    clearDocuments: args.clearDocuments,
    resumeDocuments: args.resumeDocuments,
    syncStatePath: args.syncStatePath,
    targetEnv,
    exportPath,
  });
  console.log("Done.", stats);
  await resetSharedDbPool();
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
