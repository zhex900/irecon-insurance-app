/**
 * Export legacy domain data from MSSQL.
 *
 * Usage:
 *   npx tsx scripts/export-legacy-domain.mts
 *   npx tsx scripts/export-legacy-domain.mts --out _archive/data/legacy-export.json
 *   npx tsx scripts/export-legacy-domain.mts --sql clients path/to/clients.sql
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { connectLegacyMssql, queryLegacy } from "./lib/legacy-mssql.mts";
import {
  legacyBool,
  legacyDateOnly,
  legacyNum,
  normaliseLegacyPolicyRow,
  parseLegacyNoteDescription,
} from "./lib/legacy-policy-mapper.mts";
import type {
  LegacyAccountManagerRow,
  LegacyAuthorisedRepresentativeRow,
  LegacyClientRow,
  LegacyDomainPayload,
  LegacyPolicyDocumentRow,
  LegacyPolicyNote,
  LegacyPolicyWording,
} from "./lib/legacy-payload.ts";
import { loadLegacySql, parseSqlOverrides } from "./lib/legacy-sql.mts";
import { logMigrationScopeCounts } from "./lib/legacy-migration-scope.mts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SQL_DIR = join(repoRoot, "scripts/sql/legacy");
const DEFAULT_OUT = join(repoRoot, "_archive/data/legacy-export.json");

function parseArgs(argv: string[]) {
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") {
      const next = argv[++i];
      if (next) out = isAbsolute(next) ? next : resolve(process.cwd(), next);
    }
  }
  return { out, sqlOverrides: parseSqlOverrides(argv) };
}

function isoDateTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const raw = String(value);
  if (!raw || /^null$/i.test(raw)) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function loadPolicyChildSql(fileName: string): string {
  const path = join(SQL_DIR, fileName);
  if (!existsSync(path)) {
    throw new Error(`Legacy SQL file not found: ${path}`);
  }
  return readFileSync(path, "utf8").trim();
}

function groupByPolicyId<T extends { policyId: number }>(rows: T[]) {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const list = map.get(row.policyId) ?? [];
    list.push(row);
    map.set(row.policyId, list);
  }
  return map;
}

export async function exportLegacyDomain(options?: {
  sqlOverrides?: Partial<
    Record<
      "account-managers" | "ar" | "clients" | "policies" | "documents",
      string
    >
  >;
}): Promise<LegacyDomainPayload> {
  const sqlOverrides = options?.sqlOverrides ?? {};
  const { pool, database } = await connectLegacyMssql();

  try {
    const [
      accountManagerRaw,
      arRaw,
      clientRaw,
      policyRaw,
      documentRaw,
      wordingRaw,
      noteRaw,
    ] = await Promise.all([
      queryLegacy<Record<string, unknown>>(
        pool,
        loadLegacySql("account-managers", sqlOverrides),
      ),
      queryLegacy<Record<string, unknown>>(
        pool,
        loadLegacySql("ar", sqlOverrides),
      ),
      queryLegacy<Record<string, unknown>>(
        pool,
        loadLegacySql("clients", sqlOverrides),
      ),
      queryLegacy<Record<string, unknown>>(
        pool,
        loadLegacySql("policies", sqlOverrides),
      ),
      queryLegacy<Record<string, unknown>>(
        pool,
        loadLegacySql("documents", sqlOverrides),
      ),
      queryLegacy<Record<string, unknown>>(
        pool,
        loadPolicyChildSql("policy-wordings.sql"),
      ),
      queryLegacy<Record<string, unknown>>(
        pool,
        loadPolicyChildSql("policy-notes.sql"),
      ),
    ]);

    const accountManagers: LegacyAccountManagerRow[] = accountManagerRaw.map(
      (row) => ({
        code: String(row.code ?? "").trim(),
        abbrev: String(row.abbrev ?? "").trim(),
        fullName: String(row.fullName ?? "").trim(),
        email: String(row.email ?? "").trim(),
        arNumber: String(row.arNumber ?? "").trim(),
        mobile: String(row.mobile ?? "").trim(),
      }),
    );

    const authorisedRepresentatives: LegacyAuthorisedRepresentativeRow[] =
      arRaw.map((row) => ({
        authorisedRepresentativeId: legacyNum(row.authorisedRepresentativeId),
        fullName: String(row.fullName ?? "").trim(),
        companyName: String(row.companyName ?? "").trim(),
        arNumber: String(row.arNumber ?? "").trim(),
        mobilePhone: String(row.mobilePhone ?? "").trim(),
        businessPhone: String(row.businessPhone ?? "").trim(),
        email: String(row.email ?? "").trim(),
        ownBroker: legacyBool(row.ownBroker),
      }));

    const clients: LegacyClientRow[] = clientRaw.map((row) => ({
      clientId: legacyNum(row.clientId),
      name: String(row.name ?? "").trim(),
      tradingName: String(row.tradingName ?? "").trim(),
      abn: String(row.abn ?? "").trim(),
      phone: String(row.phone ?? "").trim(),
      email: String(row.email ?? "").trim(),
      accountManagerCode: String(row.accountManagerCode ?? ".NA").trim(),
      clientSourceId: legacyNum(row.clientSourceId, 16),
      authorisedRepresentativeId:
        row.authorisedRepresentativeId == null
          ? null
          : legacyNum(row.authorisedRepresentativeId),
      createdWhen: isoDateTime(row.createdWhen),
    }));

    const wordingsByPolicyId = groupByPolicyId(
      wordingRaw.map((row): LegacyPolicyWording & { policyId: number } => ({
        policyId: legacyNum(row.policyId),
        carWordingId:
          row.carWordingId == null ? null : legacyNum(row.carWordingId),
        subject: String(row.subject ?? "").trim(),
        content: String(row.content ?? "").trim(),
      })),
    );

    const notesByPolicyId = groupByPolicyId(
      noteRaw.map((row): LegacyPolicyNote & { policyId: number } => ({
        policyId: legacyNum(row.policyId),
        policyNoteId: legacyNum(row.policyNoteId),
        policyNoteTypeId: legacyNum(row.policyNoteTypeId, 1),
        description: parseLegacyNoteDescription(
          String(row.noteDescription ?? ""),
        ),
        createdWhen: isoDateTime(row.createdWhen),
        createdBy: String(row.createdBy ?? "").trim(),
      })),
    );

    const policies = policyRaw.map((row) => {
      const policyId = legacyNum(row.policyId);
      const wordings = (wordingsByPolicyId.get(policyId) ?? []).map(
        ({ carWordingId, subject, content }) => ({
          carWordingId,
          subject,
          content,
        }),
      );
      const notes = (notesByPolicyId.get(policyId) ?? []).map(
        ({
          policyNoteId,
          policyNoteTypeId,
          description,
          createdWhen,
          createdBy,
        }) => ({
          policyNoteId,
          policyNoteTypeId,
          description,
          createdWhen,
          createdBy,
        }),
      );
      return normaliseLegacyPolicyRow(row, { wordings, notes });
    });

    const policyDocuments: LegacyPolicyDocumentRow[] = documentRaw.map(
      (row) => ({
        policyDocumentId: legacyNum(row.policyDocumentId),
        policyId: legacyNum(row.policyId),
        policyNumber: String(row.policyNumber ?? "").trim(),
        documentTypeCode: String(row.documentTypeCode ?? "").trim(),
        documentName: String(row.documentName ?? "").trim(),
        filename: String(row.filename ?? row.documentName ?? "").trim(),
        generatedWhen: isoDateTime(row.generatedWhen),
      }),
    );

    return {
      meta: {
        source: "mssql:legacy-domain",
        exportedAt: new Date().toISOString(),
        database,
      },
      accountManagers,
      authorisedRepresentatives,
      clients,
      policies,
      policyDocuments,
    };
  } finally {
    await pool.close();
  }
}

async function main() {
  const { out, sqlOverrides } = parseArgs(process.argv.slice(2));
  console.log("Exporting legacy domain from MSSQL…");
  const payload = await exportLegacyDomain({ sqlOverrides });
  logMigrationScopeCounts(payload);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${out}\n` +
      `  accountManagers=${payload.accountManagers.length} ` +
      `ar=${payload.authorisedRepresentatives.length} ` +
      `clients=${payload.clients.length} ` +
      `policies=${payload.policies.length} ` +
      `policyDocuments=${payload.policyDocuments.length}`,
  );
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
