/**
 * Shared MSSQL connection for legacy export scripts.
 * Supports MSSQL_* (root .env) and SQL_* / SERVER_NAME (_archive/mssql/.env.mssql).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ENV_FILE = join(repoRoot, "_archive/mssql/.env.mssql");

export function loadLegacyEnvFile(path = ENV_FILE) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

async function resolvePassword(): Promise<string> {
  const fromEnv =
    process.env.MSSQL_PASSWORD?.trim() ||
    process.env.SQL_PASSWORD?.trim() ||
    process.env.DB_PASSWORD?.trim();
  if (fromEnv) return fromEnv;

  const container = process.env.MSSQL_DOCKER_CONTAINER || "mssql-arm";
  const { execFileSync } = await import("node:child_process");
  try {
    const envDump = execFileSync(
      "docker",
      [
        "inspect",
        container,
        "--format",
        "{{range .Config.Env}}{{println .}}{{end}}",
      ],
      { encoding: "utf8" },
    );
    for (const line of envDump.split("\n")) {
      if (
        line.startsWith("SA_PASSWORD=") ||
        line.startsWith("MSSQL_SA_PASSWORD=")
      ) {
        return line.slice(line.indexOf("=") + 1);
      }
    }
  } catch {
    // Docker not available — fall through.
  }

  throw new Error(
    "MSSQL password not set (MSSQL_PASSWORD / SQL_PASSWORD) and could not read SA password from Docker.",
  );
}

export type LegacyMssqlConnection = {
  pool: sql.ConnectionPool;
  database: string;
};

export async function connectLegacyMssql(): Promise<LegacyMssqlConnection> {
  loadLegacyEnvFile();
  const password = await resolvePassword();
  const config: sql.config = {
    server:
      process.env.MSSQL_HOST ||
      process.env.SERVER_NAME ||
      process.env.DB_SERVER ||
      "127.0.0.1",
    port: Number(
      process.env.MSSQL_PORT ||
        process.env.SQL_PORT ||
        process.env.DB_PORT ||
        1433,
    ),
    database:
      process.env.MSSQL_DATABASE ||
      process.env.DATABASE_NAME ||
      process.env.DB_DATABASE ||
      "vs434253_1",
    user:
      process.env.MSSQL_USER ||
      process.env.SQL_USERNAME ||
      process.env.DB_USER ||
      "sa",
    password,
    options: {
      encrypt: (process.env.DB_ENCRYPT ?? "true") !== "false",
      trustServerCertificate:
        (process.env.TRUST_SERVER_CERTIFICATE ??
          process.env.DB_TRUST_SERVER_CERTIFICATE ??
          "true") !== "false",
    },
    requestTimeout: 300_000,
  };
  const pool = await sql.connect(config);
  return { pool, database: config.database! };
}

export async function queryLegacy<T extends Record<string, unknown>>(
  pool: sql.ConnectionPool,
  queryText: string,
): Promise<T[]> {
  const result = await pool.request().query(queryText);
  return result.recordset as T[];
}
