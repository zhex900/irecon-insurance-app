#!/usr/bin/env node
/**
 * Ping Supabase Postgres so free-tier projects stay active (7-day inactivity pause).
 *
 *   DATABASE_URL=... node deployment/supabase-keepalive.mjs
 *   node deployment/supabase-keepalive.mjs --label UAT
 *
 * Uses a direct SELECT (not PostgREST). Supabase counts user database activity,
 * not dashboard visits.
 */
import {
  repairSupabaseDatabaseUrl,
  toSessionDbUrl,
} from "./lib/preview-env.mjs";

const DEFAULT_TABLE = "state";
const DEFAULT_COLUMN = "state_id";
const RETRYABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
]);
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_INITIAL_DELAY_MS = 5_000;
const DEFAULT_MAX_DELAY_MS = 30_000;

function usage() {
  console.error(`Usage: node deployment/supabase-keepalive.mjs [options]

Options:
  --label NAME              Log prefix (default: Supabase)
  --table TABLE             Table to SELECT from (default: state)
  --column COLUMN           Column to SELECT (default: state_id)
  --max-attempts N          Retry count (default: ${DEFAULT_MAX_ATTEMPTS})
  --initial-delay-ms MS     First retry delay (default: ${DEFAULT_INITIAL_DELAY_MS})

Environment:
  DATABASE_URL     Postgres URL (required)
  SUPABASE_URL     Optional — fixes common DATABASE_URL typos
`);
}

function parseArgs(argv) {
  let label = "Supabase";
  let table = DEFAULT_TABLE;
  let column = DEFAULT_COLUMN;
  let maxAttempts = DEFAULT_MAX_ATTEMPTS;
  let initialDelayMs = DEFAULT_INITIAL_DELAY_MS;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--label") {
      label = argv[++i]?.trim() || label;
      continue;
    }
    if (arg === "--table") {
      table = argv[++i]?.trim() || table;
      continue;
    }
    if (arg === "--column") {
      column = argv[++i]?.trim() || column;
      continue;
    }
    if (arg === "--max-attempts") {
      maxAttempts = Number(argv[++i]);
      continue;
    }
    if (arg === "--initial-delay-ms") {
      initialDelayMs = Number(argv[++i]);
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }

  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
    console.error("--max-attempts must be a positive number.");
    process.exit(1);
  }
  if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) {
    console.error("--initial-delay-ms must be zero or greater.");
    process.exit(1);
  }

  return { label, table, column, maxAttempts, initialDelayMs };
}

function assertSqlIdentifier(name, value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    console.error(`${name} must be a simple SQL identifier (got: ${value})`);
    process.exit(1);
  }
}

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return null;
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  return toSessionDbUrl(repairSupabaseDatabaseUrl(raw, supabaseUrl));
}

function isRetryableError(error) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (RETRYABLE_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|connection terminated|too many clients|starting up/i.test(
    message,
  );
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingOnce({ databaseUrl, table, column }) {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    idle_timeout: 5,
  });

  try {
    const rows = await sql`
      select ${sql(column)} from ${sql(table)} limit 1
    `;
    return { ok: true, rows };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function pingDatabase({
  label,
  table,
  column,
  maxAttempts,
  initialDelayMs,
}) {
  assertSqlIdentifier("table", table);
  assertSqlIdentifier("column", column);

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(`${label}: DATABASE_URL is required.`);
    process.exit(1);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await pingOnce({ databaseUrl, table, column });
      const count = Array.isArray(result.rows) ? result.rows.length : 0;
      const attemptNote = attempt > 1 ? ` after ${attempt} attempt(s)` : "";
      console.log(
        `${label}: keepalive ok (${table}.${column}, ${count} row(s)${attemptNote})`,
      );
      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "unknown error");
      const retryable = isRetryableError(error);
      const isLastAttempt = attempt === maxAttempts;

      if (!retryable || isLastAttempt) {
        console.error(`${label}: keepalive failed (${message})`);
        process.exit(1);
      }

      const delayMs = Math.min(
        initialDelayMs * 2 ** (attempt - 1),
        DEFAULT_MAX_DELAY_MS,
      );
      console.warn(
        `${label}: ${message} — retry ${attempt}/${maxAttempts} in ${Math.round(delayMs / 1000)}s`,
      );
      await sleep(delayMs);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
await pingDatabase(args);
