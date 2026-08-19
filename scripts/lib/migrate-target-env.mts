/**
 * Target Postgres env for migration scripts (--env=local|uat|pr|prod).
 */
import { assertProductionDatabaseUrl } from "../../infra/lib/production-env.mjs";
import { repairSupabaseDatabaseUrl } from "../../infra/lib/preview-env.mjs";
import { applyEnvFile, readEnvFile } from "../../infra/lib/pr-env.mjs";
import { loadPrDeployEnv } from "../../infra/lib/pr-env.mjs";
import { loadUatDeployEnv } from "../../infra/lib/uat-env.mjs";

import { isLocalDatabaseUrl, maskDatabaseUrl } from "./clear-domain-data.mts";

export type MigrateTargetEnv = "local" | "uat" | "pr" | "prod";

const ENV_FILES: Record<Exclude<MigrateTargetEnv, "pr">, string> = {
  local: ".env",
  uat: ".env.uat",
  prod: ".env.production",
};

export function readOption(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || undefined;
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1]?.trim() || undefined;
  return undefined;
}

export function parseMigrateTargetEnv(): MigrateTargetEnv | undefined {
  const value = readOption("--env")?.toLowerCase();
  if (
    value === "local" ||
    value === "uat" ||
    value === "pr" ||
    value === "prod"
  ) {
    return value;
  }
  return undefined;
}

export function missingMigrateEnvHelp(): string {
  return (
    "Missing required --env=local|uat|pr|prod.\n" +
    "  npm run db:migrate:legacy -- --env=local --dry-run\n" +
    "  npm run db:migrate:legacy -- --env=uat --confirm --only clients\n" +
    "  npm run db:migrate:legacy -- --env=prod --confirm --replace"
  );
}

export async function loadMigrateTargetEnv(
  target: MigrateTargetEnv,
): Promise<string> {
  if (target === "uat") {
    await loadUatDeployEnv();
  } else if (target === "pr") {
    await loadPrDeployEnv();
  } else {
    const env = await readEnvFile(ENV_FILES[target]);
    applyEnvFile(env);

    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error(`DATABASE_URL is required in ${ENV_FILES[target]}.`);
    }

    process.env.DATABASE_URL =
      target === "prod" && env.SUPABASE_URL?.trim()
        ? repairSupabaseDatabaseUrl(databaseUrl, env.SUPABASE_URL)
        : databaseUrl;

    if (target === "local") {
      if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
        throw new Error(
          `--env=local requires DATABASE_URL in ${ENV_FILES.local} to point at localhost.`,
        );
      }
    } else {
      assertProductionDatabaseUrl(process.env.DATABASE_URL);
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is missing after loading --env=${target}.`);
  }

  if (target === "local" && !isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(`--env=local requires DATABASE_URL to point at localhost.`);
  }
  if (target !== "local" && isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(`--env=${target} must not use a localhost DATABASE_URL.`);
  }

  return databaseUrl;
}

export function assertMigrateConfirmed(
  target: MigrateTargetEnv,
  confirmFlag: boolean,
) {
  if (target === "local") return;
  if (confirmFlag) return;
  throw new Error(
    `--env=${target} requires --confirm (or use --dry-run to preview only).`,
  );
}

export function logMigrateTarget(
  target: MigrateTargetEnv,
  databaseUrl: string,
) {
  console.log(`Target: ${target}`);
  console.log(`Database: ${maskDatabaseUrl(databaseUrl)}`);
  if (target === "prod") {
    console.warn("⚠️  Production database — this cannot be undone.");
  }
}
