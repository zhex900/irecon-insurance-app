import { eq, inArray } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import {
  priceTerrorism,
  priceTerrorismPostcode,
  priceTerrorismRate,
} from "~/lib/db/price-schema";
import { NotFoundError } from "~/lib/errors";

import {
  loadStateIdByCode,
  POLICY_TYPE_CAR,
  requireDate,
  strNum,
} from "./helpers";
import type { TerrorScheduleInput } from "./types";

type TerrorTier = TerrorScheduleInput["tiers"][number];

async function insertTierPostcodes(
  dbOrTx: { insert: ReturnType<typeof getDb>["insert"] },
  priceTerrorismRateId: number,
  tier: TerrorTier,
  stateIdByCode: Map<string, number>,
) {
  const seen = new Set<string>();
  for (const entry of tier.postcodes ?? []) {
    const postcode = String(entry.postcode ?? "").trim();
    const stateCode = String(entry.stateCode ?? "")
      .trim()
      .toUpperCase();
    if (!postcode || !stateCode) continue;
    if (seen.has(postcode)) continue;
    const stateId = stateIdByCode.get(stateCode);
    if (stateId == null) {
      throw new Error(
        `Unknown state "${stateCode}" for postcode ${postcode} (tier ${tier.tier})`,
      );
    }
    seen.add(postcode);
    await dbOrTx.insert(priceTerrorismPostcode).values({
      priceTerrorismRateId,
      postcode,
      stateId,
    });
  }
}

export async function createTerrorSchedule(
  input: TerrorScheduleInput,
  createdBy: string,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  if (!input.tiers.length) throw new Error("Add at least one tier");

  return db.transaction(async (tx) => {
    const stateIdByCode = await loadStateIdByCode(tx);
    const [header] = await tx
      .insert(priceTerrorism)
      .values({
        policyTypeId: POLICY_TYPE_CAR,
        dateStart,
        published: input.published,
        datePublished: input.published ? new Date() : null,
        createdBy,
      })
      .returning();
    for (const tier of input.tiers) {
      const [rateRow] = await tx
        .insert(priceTerrorismRate)
        .values({
          priceTerrorismId: header.priceTerrorismId,
          tier: tier.tier.trim(),
          rate: strNum(tier.rate),
        })
        .returning();
      await insertTierPostcodes(
        tx,
        rateRow.priceTerrorismRateId,
        tier,
        stateIdByCode,
      );
    }
    return header.priceTerrorismId;
  });
}

export async function updateTerrorSchedule(
  priceTerrorismId: number,
  input: TerrorScheduleInput,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  if (!input.tiers.length) throw new Error("Add at least one tier");

  await db.transaction(async (tx) => {
    const stateIdByCode = await loadStateIdByCode(tx);
    const [existing] = await tx
      .select()
      .from(priceTerrorism)
      .where(eq(priceTerrorism.priceTerrorismId, priceTerrorismId))
      .limit(1);
    if (!existing) throw new NotFoundError("Terrorism schedule not found");

    await tx
      .update(priceTerrorism)
      .set({
        dateStart,
        published: input.published,
        datePublished: input.published
          ? (existing.datePublished ?? new Date())
          : null,
      })
      .where(eq(priceTerrorism.priceTerrorismId, priceTerrorismId));

    const oldRates = await tx
      .select({ priceTerrorismRateId: priceTerrorismRate.priceTerrorismRateId })
      .from(priceTerrorismRate)
      .where(eq(priceTerrorismRate.priceTerrorismId, priceTerrorismId));
    const oldIds = oldRates.map((r) => r.priceTerrorismRateId);
    if (oldIds.length) {
      await tx
        .delete(priceTerrorismPostcode)
        .where(inArray(priceTerrorismPostcode.priceTerrorismRateId, oldIds));
      await tx
        .delete(priceTerrorismRate)
        .where(eq(priceTerrorismRate.priceTerrorismId, priceTerrorismId));
    }

    for (const tier of input.tiers) {
      const [rateRow] = await tx
        .insert(priceTerrorismRate)
        .values({
          priceTerrorismId,
          tier: tier.tier.trim(),
          rate: strNum(tier.rate),
        })
        .returning();
      await insertTierPostcodes(
        tx,
        rateRow.priceTerrorismRateId,
        tier,
        stateIdByCode,
      );
    }
  });
}

export async function deleteTerrorSchedule(priceTerrorismId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const rates = await tx
      .select({ priceTerrorismRateId: priceTerrorismRate.priceTerrorismRateId })
      .from(priceTerrorismRate)
      .where(eq(priceTerrorismRate.priceTerrorismId, priceTerrorismId));
    const ids = rates.map((r) => r.priceTerrorismRateId);
    if (ids.length) {
      await tx
        .delete(priceTerrorismPostcode)
        .where(inArray(priceTerrorismPostcode.priceTerrorismRateId, ids));
      await tx
        .delete(priceTerrorismRate)
        .where(eq(priceTerrorismRate.priceTerrorismId, priceTerrorismId));
    }
    await tx
      .delete(priceTerrorism)
      .where(eq(priceTerrorism.priceTerrorismId, priceTerrorismId));
  });
}
