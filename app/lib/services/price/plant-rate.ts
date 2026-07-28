import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { pricePlant } from "~/lib/db/price-schema";
import { POLICY_TYPE_CAR, requireDate, strNum } from "./helpers";
import type { PlantRateInput } from "./types";

export async function createPlantRate(
  input: PlantRateInput,
  createdBy: string,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  const [row] = await db
    .insert(pricePlant)
    .values({
      policyTypeId: POLICY_TYPE_CAR,
      dateStart,
      published: input.published,
      datePublished: input.published ? new Date() : null,
      rate: strNum(input.rate),
      plantMinValue: strNum(input.plantMinValue),
      plantMaxValue: strNum(input.plantMaxValue),
      createdBy,
    })
    .returning();
  return row.pricePlantId;
}

export async function updatePlantRate(
  pricePlantId: number,
  input: PlantRateInput,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  const [existing] = await db
    .select()
    .from(pricePlant)
    .where(eq(pricePlant.pricePlantId, pricePlantId))
    .limit(1);
  if (!existing) throw new Error("Plant rate not found");

  await db
    .update(pricePlant)
    .set({
      dateStart,
      published: input.published,
      datePublished: input.published
        ? (existing.datePublished ?? new Date())
        : null,
      rate: strNum(input.rate),
      plantMinValue: strNum(input.plantMinValue),
      plantMaxValue: strNum(input.plantMaxValue),
    })
    .where(eq(pricePlant.pricePlantId, pricePlantId));
}

export async function deletePlantRate(pricePlantId: number) {
  const db = getDb();
  await db.delete(pricePlant).where(eq(pricePlant.pricePlantId, pricePlantId));
}
