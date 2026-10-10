#!/usr/bin/env tsx
/**
 * Backfill required CAR policy fields on migrated policies using app defaults.
 *
 *   npm run db:repair:migrated-policies -- --env=local
 *   npm run db:repair:migrated-policies -- --env=local --dry-run
 *   npm run db:repair:migrated-policies -- --env=uat --confirm
 */
import { eq } from "drizzle-orm";

import { policyToFormValues } from "../../../app/components/policies/wizard/shared/policy-to-values";
import { getDb, resetSharedDbPool } from "../../../app/lib/db/client";
import { rowsToPolicy } from "../../../app/lib/db/policy-mapper";
import {
  policy,
  policyCar,
  policyCarAdjustment,
} from "../../../app/lib/db/schema";
import { carPolicySchema } from "../../../app/lib/zod/policy-car";
import {
  assertMigrateConfirmed,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
} from "../lib/migrate-target-env.mts";
import { buildMigratedPolicyRepairPatch } from "../legacy/lib/repair-migrated-policy-fields.mts";

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function countValidationFailures(
  policies: (typeof policy.$inferSelect)[],
  db: ReturnType<typeof getDb>,
  label: string,
): Promise<number> {
  let fail = 0;
  const total = policies.length;
  for (let i = 0; i < total; i++) {
    const p = policies[i]!;
    if (i > 0 && i % 250 === 0) {
      console.log(`  ${label}: ${i}/${total}…`);
    }
    const [car] = await db
      .select()
      .from(policyCar)
      .where(eq(policyCar.policyId, p.policyId));
    if (!car) continue;
    const doc = rowsToPolicy(p, car, null);
    const values = policyToFormValues(doc);
    const parsed = carPolicySchema.safeParse({
      ...values,
      clientId: p.clientId,
      policyStatusId: p.policyStatusId,
    });
    if (!parsed.success) fail += 1;
  }
  return fail;
}

async function main() {
  const target = parseMigrateTargetEnv();
  if (!target) {
    throw new Error(missingMigrateEnvHelp());
  }

  const dryRun = readFlag("--dry-run");
  const confirm = readFlag("--confirm");

  const databaseUrl = await loadMigrateTargetEnv(target);
  logMigrateTarget(target, databaseUrl);
  if (dryRun) console.log("Mode: dry-run (no writes)");
  assertMigrateConfirmed(target, confirm);

  const db = getDb();
  const policies = await db
    .select()
    .from(policy)
    .where(eq(policy.createdBy, "migrate:mssql"));

  console.log(
    `Checking ${policies.length} migrated policies (validation pass 1)…`,
  );
  const failBefore = await countValidationFailures(
    policies,
    db,
    "validation pass 1",
  );
  let updated = 0;
  const samples: string[] = [];

  console.log("Applying repair patches…");
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i]!;
    if (i > 0 && i % 250 === 0) {
      console.log(`  repair: ${i}/${policies.length}…`);
    }
    const [car] = await db
      .select()
      .from(policyCar)
      .where(eq(policyCar.policyId, p.policyId));
    if (!car) continue;

    const [adjustment] = await db
      .select()
      .from(policyCarAdjustment)
      .where(eq(policyCarAdjustment.policyId, p.policyId));

    const patch = buildMigratedPolicyRepairPatch({
      policyStatusId: p.policyStatusId,
      postcode: p.postcode,
      dateStart: p.dateStart.toISOString(),
      dateEnd: p.dateEnd.toISOString(),
      coverTypeId: car.coverTypeId,
      annualCoverTypeId: car.annualCoverTypeId,
      businessActivities: car.businessActivities,
      insuredContracts: car.insuredContracts,
      geographicalScopes: car.geographicalScopes,
      maximumConstructionPeriod: car.maximumConstructionPeriod,
      maximumMaintenancePeriod: car.maximumMaintenancePeriod,
      declarationConfirmed: car.declarationConfirmed,
      liabilityLimitBand: car.liabilityLimitBand,
      estimatedTurnover: Number(car.estimatedTurnover),
      subLimits: (car.subLimits ?? {}) as Record<string, string>,
      excesses: (car.excesses ?? {}) as Record<string, string>,
      excludedContracts1: car.excludedContracts1 ?? "",
      excludedContracts2: car.excludedContracts2 ?? "",
      excludedContracts3: car.excludedContracts3 ?? "",
      siteAddress: car.siteAddress,
    });

    if (!patch) continue;

    updated += 1;
    if (samples.length < 8) {
      const bits = [
        patch.policy?.postcode ? `postcode→${patch.policy.postcode}` : null,
        patch.policy?.dateEnd ? "dateEnd capped" : null,
        patch.policyCar?.declarationConfirmed ? "declaration→true" : null,
        patch.policyCar?.maximumConstructionPeriod != null
          ? `construction→${patch.policyCar.maximumConstructionPeriod}`
          : null,
        patch.policyCar?.excesses || patch.policyCar?.excludedContracts1
          ? "excesses/defaults"
          : null,
      ].filter(Boolean);
      samples.push(`${p.policyNumber}: ${bits.join(", ") || "fields updated"}`);
    }

    if (dryRun) continue;

    if (patch.policy) {
      await db
        .update(policy)
        .set(patch.policy)
        .where(eq(policy.policyId, p.policyId));
    }
    if (patch.policyCar) {
      await db
        .update(policyCar)
        .set(patch.policyCar)
        .where(eq(policyCar.policyId, p.policyId));
    }

    void adjustment;
  }

  let failAfter = failBefore;
  if (!dryRun) {
    console.log("Re-checking validation after updates…");
    failAfter = await countValidationFailures(
      policies,
      db,
      "validation pass 2",
    );
  }

  console.log(
    dryRun
      ? `Would update ${updated} of ${policies.length} migrated policies`
      : `Updated ${updated} of ${policies.length} migrated policies`,
  );
  console.log(
    `Validation failures: ${failBefore} before${dryRun ? " (unchanged in dry-run)" : ` → ${failAfter} after`}`,
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
