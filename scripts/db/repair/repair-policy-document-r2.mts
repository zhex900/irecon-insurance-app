#!/usr/bin/env tsx
/**
 * Backfill policy_document.r2_key for template-generated rows missing R2 objects.
 *
 *   npm run db:repair:policy-document-r2 -- --env=local
 *   npm run db:repair:policy-document-r2 -- --env=local --dry-run
 *   npm run db:repair:policy-document-r2 -- --env=uat --confirm --limit 50
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { type Font, getDefaultFont } from "@pdfme/common";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

import { getDb, resetSharedDbPool } from "../../../app/lib/db/client";
import { policyDocument } from "../../../app/lib/db/schema";
import { generatePolicyPdf } from "../../../app/lib/pdf/generate.ts";
import { resolvePublishedPdfTemplate } from "../../../app/lib/services/documents/document-templates";
import { getPolicy } from "../../../app/lib/services/policy/data.service";
import { getCarWording } from "../../../app/lib/services/reference.service";
import { policyDocumentObjectKey } from "../../../app/lib/storage/policy-documents.server";
import { resolveBrokerFeeLines } from "../../../app/server/pricing/rate-resolver";
import {
  assertMigrateConfirmed,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
} from "../lib/migrate-target-env.mts";
import {
  hasR2Credentials,
  uploadPolicyDocumentBytesToR2,
} from "../legacy/lib/legacy-document-upload.mts";

const REPAIR_FONT_FILES = {
  "Roboto Bold": "Roboto-Bold.ttf",
  "Roboto Italic": "Roboto-Italic.ttf",
  "Roboto Bold Italic": "Roboto-BoldItalic.ttf",
  "Times New Roman": "Tinos-Regular.ttf",
  "Times New Roman Bold": "Tinos-Bold.ttf",
  "Times New Roman Italic": "Tinos-Italic.ttf",
  "Times New Roman Bold Italic": "Tinos-BoldItalic.ttf",
} as const;

async function loadRepairScriptFonts(): Promise<Font> {
  const defaults = getDefaultFont();
  const entries = await Promise.all(
    Object.entries(REPAIR_FONT_FILES).map(async ([name, filename]) => [
      name,
      {
        data: (
          await readFile(join(process.cwd(), "public/fonts", filename))
        ).buffer.slice() as ArrayBuffer,
      },
    ]),
  );
  return {
    Roboto: { data: defaults.Roboto.data, fallback: true },
    ...Object.fromEntries(entries),
  };
}

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readLimit(): number | undefined {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  if (!arg) return undefined;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main() {
  const target = parseMigrateTargetEnv();
  if (!target) {
    throw new Error(missingMigrateEnvHelp());
  }

  const dryRun = readFlag("--dry-run");
  const confirm = readFlag("--confirm");
  const limit = readLimit();

  const databaseUrl = await loadMigrateTargetEnv(target);
  logMigrateTarget(target, databaseUrl);
  if (dryRun) console.log("Mode: dry-run (no writes)");
  assertMigrateConfirmed(target, confirm);

  if (!dryRun && !hasR2Credentials()) {
    throw new Error(
      "R2 credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT).",
    );
  }

  const db = getDb();
  const missingRows = await db
    .select({
      documentId: policyDocument.documentId,
      policyId: policyDocument.policyId,
      filename: policyDocument.filename,
      templateKey: policyDocument.templateKey,
    })
    .from(policyDocument)
    .where(
      and(
        isNotNull(policyDocument.templateKey),
        or(isNull(policyDocument.r2Key), sql`${policyDocument.r2Key} = ''`),
      ),
    )
    .limit(limit ?? 10_000);

  if (missingRows.length === 0) {
    console.log("No template policy documents missing r2_key.");
    return;
  }

  console.log(`Found ${missingRows.length} document(s) to backfill.`);

  const [wordingCatalogue, font] = await Promise.all([
    getCarWording(),
    loadRepairScriptFonts(),
  ]);

  const byPolicy = new Map<string, typeof missingRows>();
  for (const row of missingRows) {
    const list = byPolicy.get(row.policyId) ?? [];
    list.push(row);
    byPolicy.set(row.policyId, list);
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [policyId, rows] of byPolicy) {
    const policy = await getPolicy(policyId);
    if (!policy) {
      console.warn(`  skip policy ${policyId} — not found`);
      skipped += rows.length;
      continue;
    }

    const brokerFeeLines = await resolveBrokerFeeLines(policy.dateStart);

    for (const row of rows) {
      const templateKey = row.templateKey;
      if (!templateKey) {
        skipped += 1;
        continue;
      }

      const r2Key = policyDocumentObjectKey(
        policyId,
        row.documentId,
        row.filename || "document.pdf",
      );

      if (dryRun) {
        console.log(`  [dry-run] ${row.documentId} → ${r2Key}`);
        uploaded += 1;
        continue;
      }

      try {
        const resolved = await resolvePublishedPdfTemplate(templateKey);
        if (!resolved) {
          console.warn(
            `  skip ${row.documentId} — no published template ${templateKey}`,
          );
          skipped += 1;
          continue;
        }

        const { pdf } = await generatePolicyPdf(
          templateKey,
          policy,
          undefined,
          resolved,
          { wordingCatalogue, brokerFeeLines, font },
        );

        await uploadPolicyDocumentBytesToR2({ bytes: pdf, r2Key });

        await db
          .update(policyDocument)
          .set({ r2Key })
          .where(eq(policyDocument.documentId, row.documentId));

        uploaded += 1;
        console.log(`  uploaded ${row.documentId} → ${r2Key}`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  failed ${row.documentId}: ${message}`);
      }
    }
  }

  console.log(
    `Done — uploaded ${uploaded}, skipped ${skipped}, failed ${failed}.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    resetSharedDbPool();
  });
