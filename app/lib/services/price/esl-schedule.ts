import { eq } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { priceEsl, priceEslRate } from "~/lib/db/price-schema";
import { NotFoundError } from "~/lib/errors";

import {
  loadStateIdByCode,
  POLICY_TYPE_CAR,
  requireDate,
  requireStateId,
  strNum,
} from "./helpers";
import type { EslScheduleInput } from "./types";

export async function createEslSchedule(
  input: EslScheduleInput,
  createdBy: string,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  return db.transaction(async (tx) => {
    const stateIdByCode = await loadStateIdByCode(tx);
    const [header] = await tx
      .insert(priceEsl)
      .values({
        policyTypeId: POLICY_TYPE_CAR,
        dateStart,
        published: input.published,
        datePublished: input.published ? new Date() : null,
        createdBy,
      })
      .returning();
    for (const rate of input.rates) {
      const stateId = requireStateId(stateIdByCode, rate.stateCode);
      await tx.insert(priceEslRate).values({
        priceEslId: header.priceEslId,
        stateId,
        constructionRate: strNum(rate.constructionRate),
        plantRate: strNum(rate.plantRate),
      });
    }
    return header.priceEslId;
  });
}

export async function updateEslSchedule(
  priceEslId: number,
  input: EslScheduleInput,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  await db.transaction(async (tx) => {
    const stateIdByCode = await loadStateIdByCode(tx);
    const [existing] = await tx
      .select()
      .from(priceEsl)
      .where(eq(priceEsl.priceEslId, priceEslId))
      .limit(1);
    if (!existing) throw new NotFoundError("ESL schedule not found");

    await tx
      .update(priceEsl)
      .set({
        dateStart,
        published: input.published,
        datePublished: input.published
          ? (existing.datePublished ?? new Date())
          : null,
      })
      .where(eq(priceEsl.priceEslId, priceEslId));

    await tx
      .delete(priceEslRate)
      .where(eq(priceEslRate.priceEslId, priceEslId));
    for (const rate of input.rates) {
      const stateId = requireStateId(stateIdByCode, rate.stateCode);
      await tx.insert(priceEslRate).values({
        priceEslId,
        stateId,
        constructionRate: strNum(rate.constructionRate),
        plantRate: strNum(rate.plantRate),
      });
    }
  });
}

export async function deleteEslSchedule(priceEslId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(priceEslRate)
      .where(eq(priceEslRate.priceEslId, priceEslId));
    await tx.delete(priceEsl).where(eq(priceEsl.priceEslId, priceEslId));
  });
}
