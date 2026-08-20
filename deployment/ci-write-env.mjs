#!/usr/bin/env node
/**
 * Write .env.uat, .env.pr, or .env.production from process.env (GitHub Actions secrets/vars).
 *
 *   node deployment/ci-write-env.mjs uat
 *   node deployment/ci-write-env.mjs pr
 *   node deployment/ci-write-env.mjs production
 */
import { writeFile } from "node:fs/promises";

import { CI_ENV_PROFILE_KEYS } from "./lib/constants.mjs";

const profile = process.argv[2];

const KEYS = CI_ENV_PROFILE_KEYS;

if (!profile || !(profile in KEYS)) {
  console.error("Usage: node deployment/ci-write-env.mjs <uat|pr|production>");
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

if (profile === "production" && !process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required (production environment secret).");
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
