import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { price, priceCar } from "~/lib/db/price-schema";
import { POLICY_TYPE_CAR, requireDate, strNum } from "./helpers";
import type { CarScheduleInput } from "./types";

export async function createCarSchedule(
  input: CarScheduleInput,
  createdBy: string,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  if (!input.bands.length) throw new Error("Add at least one rate band");

  return db.transaction(async (tx) => {
    const [header] = await tx
      .insert(price)
      .values({
        policyTypeId: POLICY_TYPE_CAR,
        dateStart,
        published: input.published,
        datePublished: input.published ? new Date() : null,
        createdBy,
      })
      .returning();
    await tx.insert(priceCar).values(
      input.bands.map((band) => ({
        priceId: header.priceId,
        coverTypeId: band.coverTypeId,
        turnoverMin: strNum(band.turnoverMin),
        turnoverMax: band.turnoverMax == null ? null : strNum(band.turnoverMax),
        contractWorksRate: strNum(band.contractWorksRate),
        contractWorksMinPremium: strNum(band.contractWorksMinPremium),
        liability10mRate: strNum(band.liability10mRate),
        liability10mMinPremium: strNum(band.liability10mMinPremium),
        liability20mRate: strNum(band.liability20mRate),
        liability20mMinPremium: strNum(band.liability20mMinPremium),
      })),
    );
    return header.priceId;
  });
}

export async function updateCarSchedule(
  priceId: number,
  input: CarScheduleInput,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  if (!input.bands.length) throw new Error("Add at least one rate band");

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(price)
      .where(eq(price.priceId, priceId))
      .limit(1);
    if (!existing) throw new Error("CAR schedule not found");

    await tx
      .update(price)
      .set({
        dateStart,
        published: input.published,
        datePublished: input.published
          ? (existing.datePublished ?? new Date())
          : null,
      })
      .where(eq(price.priceId, priceId));

    await tx.delete(priceCar).where(eq(priceCar.priceId, priceId));
    await tx.insert(priceCar).values(
      input.bands.map((band) => ({
        priceId,
        coverTypeId: band.coverTypeId,
        turnoverMin: strNum(band.turnoverMin),
        turnoverMax: band.turnoverMax == null ? null : strNum(band.turnoverMax),
        contractWorksRate: strNum(band.contractWorksRate),
        contractWorksMinPremium: strNum(band.contractWorksMinPremium),
        liability10mRate: strNum(band.liability10mRate),
        liability10mMinPremium: strNum(band.liability10mMinPremium),
        liability20mRate: strNum(band.liability20mRate),
        liability20mMinPremium: strNum(band.liability20mMinPremium),
      })),
    );
  });
}

export async function deleteCarSchedule(priceId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(priceCar).where(eq(priceCar.priceId, priceId));
    await tx.delete(price).where(eq(price.priceId, priceId));
  });
}
