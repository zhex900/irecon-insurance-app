#!/usr/bin/env node
/**
 * Write .env.uat or .env.pr from process.env (GitHub Actions secrets/vars).
 *
 *   node scripts/ci-write-env.mjs uat
 *   node scripts/ci-write-env.mjs pr
 */
import { writeFile } from "node:fs/promises";

const profile = process.argv[2];

const KEYS = {
  uat: [
    "APP_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
    "VITE_SENTRY_DSN",
    "SENTRY_DSN",
    "VITE_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ],
  pr: [
    "BASE_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "UAT_DATABASE_URL",
    "UAT_SUPABASE_URL",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_S3_ENDPOINT",
    "SUPABASE_ACCESS_TOKEN",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
    "VITE_SENTRY_DSN",
    "SENTRY_DSN",
    "VITE_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ],
};

if (!profile || !(profile in KEYS)) {
  console.error("Usage: node scripts/ci-write-env.mjs <uat|pr>");
  process.exit(1);
}

const lines = [];
for (const key of KEYS[profile]) {
  const value = process.env[key]?.trim();
  if (value) lines.push(`${key}=${value}`);
}

if (profile === "uat" && !process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required (uat environment secret).");
  process.exit(1);
}

if (profile === "pr") {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required (pr environment secret).");
    process.exit(1);
  }
  if (!process.env.UAT_DATABASE_URL?.trim()) {
    console.error("UAT_DATABASE_URL is required (pr environment secret).");
    process.exit(1);
  }
}

await writeFile(`.env.${profile}`, `${lines.join("\n")}\n`, "utf8");
console.log(`✓ Wrote .env.${profile} (${lines.length} keys)`);
