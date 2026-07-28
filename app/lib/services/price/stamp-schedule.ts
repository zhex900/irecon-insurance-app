import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { priceStampDuty, priceStampDutyRate } from "~/lib/db/price-schema";
import { POLICY_TYPE_CAR, requireDate, stateIdByCode, strNum } from "./helpers";
import type { StampScheduleInput } from "./types";

export async function createStampSchedule(
  input: StampScheduleInput,
  createdBy: string,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  return db.transaction(async (tx) => {
    const [header] = await tx
      .insert(priceStampDuty)
      .values({
        policyTypeId: POLICY_TYPE_CAR,
        dateStart,
        published: input.published,
        datePublished: input.published ? new Date() : null,
        createdBy,
      })
      .returning();
    for (const rate of input.rates) {
      const stateId = await stateIdByCode(rate.stateCode);
      await tx.insert(priceStampDutyRate).values({
        priceStampDutyId: header.priceStampDutyId,
        stateId,
        rate: strNum(rate.rate),
      });
    }
    return header.priceStampDutyId;
  });
}

export async function updateStampSchedule(
  priceStampDutyId: number,
  input: StampScheduleInput,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(priceStampDuty)
      .where(eq(priceStampDuty.priceStampDutyId, priceStampDutyId))
      .limit(1);
    if (!existing) throw new Error("Stamp duty schedule not found");

    await tx
      .update(priceStampDuty)
      .set({
        dateStart,
        published: input.published,
        datePublished: input.published
          ? (existing.datePublished ?? new Date())
          : null,
      })
      .where(eq(priceStampDuty.priceStampDutyId, priceStampDutyId));

    await tx
      .delete(priceStampDutyRate)
      .where(eq(priceStampDutyRate.priceStampDutyId, priceStampDutyId));
    for (const rate of input.rates) {
      const stateId = await stateIdByCode(rate.stateCode);
      await tx.insert(priceStampDutyRate).values({
        priceStampDutyId,
        stateId,
        rate: strNum(rate.rate),
      });
    }
  });
}

export async function deleteStampSchedule(priceStampDutyId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(priceStampDutyRate)
      .where(eq(priceStampDutyRate.priceStampDutyId, priceStampDutyId));
    await tx
      .delete(priceStampDuty)
      .where(eq(priceStampDuty.priceStampDutyId, priceStampDutyId));
  });
}
