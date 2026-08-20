#!/usr/bin/env node
/**
 * Ping Supabase PostgREST so free-tier projects stay active (7-day inactivity pause).
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node deployment/supabase-keepalive.mjs
 *   node deployment/supabase-keepalive.mjs --label UAT
 *
 * Uses service role key to bypass RLS. A harmless SELECT on a stable lookup table
 * is enough — Supabase counts user database activity, not dashboard visits.
 */
const DEFAULT_TABLE = "state";
const DEFAULT_COLUMN = "state_id";

function usage() {
  console.error(`Usage: node deployment/supabase-keepalive.mjs [--label NAME] [--table TABLE] [--column COLUMN]

Environment:
  SUPABASE_URL          Project URL (required)
  SUPABASE_SECRET_KEY   Service role key (required)
`);
}

function parseArgs(argv) {
  let label = "Supabase";
  let table = DEFAULT_TABLE;
  let column = DEFAULT_COLUMN;

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
    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }

  return { label, table, column };
}

async function pingSupabase({ label, table, column }) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !secretKey) {
    console.error(
      `${label}: SUPABASE_URL and SUPABASE_SECRET_KEY are required.`,
    );
    process.exit(1);
  }

  const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(column)}&limit=1`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `${label}: keepalive failed (${response.status} ${response.statusText})`,
    );
    if (body) console.error(body.slice(0, 500));
    process.exit(1);
  }

  const rows = await response.json();
  const count = Array.isArray(rows) ? rows.length : 0;
  console.log(`${label}: keepalive ok (${table}.${column}, ${count} row(s))`);
}

const args = parseArgs(process.argv.slice(2));
await pingSupabase(args);
