/**
 * Load legacy SQL query files (override via --sql <slice> <path>).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { LegacyDomainSlice } from "./legacy-payload.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SQL_DIR = join(repoRoot, "scripts/db/legacy/sql");

const FILE_BY_SLICE: Record<LegacyDomainSlice, string> = {
  "account-managers": "account-managers.sql",
  ar: "authorised-representatives.sql",
  clients: "clients.sql",
  policies: "policies.sql",
  documents: "policy-documents.sql",
};

export function defaultSqlPath(slice: LegacyDomainSlice): string {
  return join(SQL_DIR, FILE_BY_SLICE[slice]);
}

export function loadLegacySql(
  slice: LegacyDomainSlice,
  overrides?: Partial<Record<LegacyDomainSlice, string>>,
): string {
  const custom = overrides?.[slice];
  const path = custom
    ? isAbsolute(custom)
      ? custom
      : resolve(process.cwd(), custom)
    : defaultSqlPath(slice);
  if (!existsSync(path)) {
    throw new Error(`Legacy SQL file not found for ${slice}: ${path}`);
  }
  return readFileSync(path, "utf8").trim();
}

export function parseSqlOverrides(
  argv: string[],
): Partial<Record<LegacyDomainSlice, string>> {
  const overrides: Partial<Record<LegacyDomainSlice, string>> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--sql") continue;
    const slice = argv[++i] as LegacyDomainSlice | undefined;
    const path = argv[++i];
    if (!slice || !path) {
      throw new Error(
        "Usage: --sql <account-managers|ar|clients|policies|documents> <path>",
      );
    }
    if (!(slice in FILE_BY_SLICE)) {
      throw new Error(`Unknown SQL slice: ${slice}`);
    }
    overrides[slice] = path;
  }
  return overrides;
}
