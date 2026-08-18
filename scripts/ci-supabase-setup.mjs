/**
 * Start local Supabase (Docker), apply migrations, and export env for CI.
 *
 * Usage:
 *   node scripts/ci-supabase-setup.mjs
 *
 * When GITHUB_ENV is set, writes DATABASE_URL and Supabase keys for later workflow steps.
 */
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

/** Services not required for Vitest integration tests. */
const EXCLUDED_SERVICES =
  "studio,imgproxy,edge-runtime,logflare,vector,supavisor";

function run(command, env = process.env) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit", env });
}

function parseSupabaseEnv(output) {
  const env = {};
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
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

function readSupabaseEnv() {
  const output = execSync("npx supabase status -o env", { encoding: "utf8" });
  return parseSupabaseEnv(output);
}

function appEnvFromSupabase(statusEnv) {
  return {
    DATABASE_URL:
      statusEnv.DB_URL ??
      statusEnv.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    SUPABASE_URL: statusEnv.API_URL ?? statusEnv.SUPABASE_URL ?? "",
    SUPABASE_SECRET_KEY:
      statusEnv.SECRET_KEY ??
      statusEnv.SUPABASE_SECRET_KEY ??
      statusEnv.SERVICE_ROLE_KEY ??
      "",
    SUPABASE_PUBLISHABLE_KEY:
      statusEnv.PUBLISHABLE_KEY ??
      statusEnv.SUPABASE_PUBLISHABLE_KEY ??
      statusEnv.ANON_KEY ??
      "",
  };
}

function exportToGithubEnv(appEnv) {
  const githubEnv = process.env.GITHUB_ENV?.trim();
  if (!githubEnv) return;

  const lines = Object.entries(appEnv).map(([key, value]) => `${key}=${value}`);
  appendFileSync(githubEnv, `${lines.join("\n")}\n`);
}

run("npx supabase stop --no-backup || true");
run(`npx supabase start -x ${EXCLUDED_SERVICES}`);
run("npx supabase db reset --yes");

const appEnv = appEnvFromSupabase(readSupabaseEnv());
Object.assign(process.env, appEnv);

if (!appEnv.SUPABASE_URL || !appEnv.SUPABASE_SECRET_KEY) {
  throw new Error(
    "Could not read Supabase URL/keys from `supabase status -o env`.",
  );
}

exportToGithubEnv(appEnv);

console.log("Supabase CI setup complete.");
