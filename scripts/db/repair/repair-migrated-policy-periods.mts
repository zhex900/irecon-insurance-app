#!/usr/bin/env tsx
/**
 * Backfill maximum construction / maintenance periods on migrated policies.
 *
 * Legacy MSSQL stores 0 for unset period columns. COALESCE(..., 18) does not
 * help because 0 is not NULL. This script applies the same cover-type-aware
 * defaults used by scripts/db/legacy/lib/legacy-policy-mapper.mts.
 *
 *   npm run db:repair:policy-periods -- --env=local
 *   npm run db:repair:policy-periods -- --env=local --dry-run
 *   npm run db:repair:policy-periods -- --env=uat --confirm
 */
import { sql } from "drizzle-orm";

import { getDb, resetSharedDbPool } from "../../../app/lib/db/client";
import { policy, policyCar } from "../../../app/lib/db/schema";
import {
  assertMigrateConfirmed,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
} from "../lib/migrate-target-env.mts";
import { defaultConstructionPeriodMonths } from "../legacy/lib/legacy-policy-mapper.mts";

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const target = parseMigrateTargetEnv();
  if (!target) {
    throw new Error(missingMigrateEnvHelp());
  }

  const dryRun = readFlag("--dry-run");
  const confirm = readFlag("--confirm");

  await loadMigrateTargetEnv(target);
  logMigrateTarget(target, dryRun ? "dry-run repair" : "repair policy periods");
  assertMigrateConfirmed(target, confirm);

  const db = getDb();

  const rows = await db
    .select({
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      coverTypeId: policyCar.coverTypeId,
      maximumConstructionPeriod: policyCar.maximumConstructionPeriod,
      maximumMaintenancePeriod: policyCar.maximumMaintenancePeriod,
    })
    .from(policy)
    .innerJoin(policyCar, sql`${policyCar.policyId} = ${policy.policyId}`)
    .where(sql`${policy.createdBy} = 'migrate:mssql'`);

  let updated = 0;
  const samples: string[] = [];

  for (const row of rows) {
    const nextConstruction =
      row.maximumConstructionPeriod > 0
        ? row.maximumConstructionPeriod
        : defaultConstructionPeriodMonths(row.coverTypeId);
    const nextMaintenance =
      row.maximumMaintenancePeriod > 0 ? row.maximumMaintenancePeriod : 12;

    if (
      nextConstruction === row.maximumConstructionPeriod &&
      nextMaintenance === row.maximumMaintenancePeriod
    ) {
      continue;
    }

    updated += 1;
    if (samples.length < 5) {
      samples.push(
        `${row.policyNumber}: construction ${row.maximumConstructionPeriod}→${nextConstruction}, maintenance ${row.maximumMaintenancePeriod}→${nextMaintenance}`,
      );
    }

    if (!dryRun) {
      await db
        .update(policyCar)
        .set({
          maximumConstructionPeriod: nextConstruction,
          maximumMaintenancePeriod: nextMaintenance,
        })
        .where(sql`${policyCar.policyId} = ${row.policyId}`);
    }
  }

  console.log(
    dryRun
      ? `Would update ${updated} of ${rows.length} migrated policies`
      : `Updated ${updated} of ${rows.length} migrated policies`,
  );
  if (samples.length) {
    console.log("Sample changes:");
    for (const line of samples) console.log(`  ${line}`);
  }

  await resetSharedDbPool();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await resetSharedDbPool().catch(() => {});
    process.exit(1);
  });
