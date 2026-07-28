import { asc } from "drizzle-orm";
import { carWordingData } from "~/lib/car-wording-data";
import { referenceData } from "~/lib/reference-data";
import { getDb } from "~/lib/db/client";
import { carWording, policyCarExcessDefault } from "~/lib/db/schema";
import { defaultExcessesFromCatalogue } from "~/lib/excesses";
import { listAuthorisedRepresentatives } from "~/lib/services/authorised-representatives/service";
import type { CarWording, ReferenceData } from "~/lib/db/types";

export function getReferenceData(): ReferenceData {
  return referenceData;
}

/** Reference data with live ARs + excess defaults from the DB. */
export async function getReferenceDataAsync(): Promise<ReferenceData> {
  const [wholesaleBrokers, defaultExcesses] = await Promise.all([
    listAuthorisedRepresentatives(),
    getDefaultExcesses(),
  ]);
  return {
    ...getReferenceData(),
    wholesaleBrokers,
    defaultExcesses,
  };
}

export async function getDefaultExcesses(): Promise<
  ReferenceData["defaultExcesses"]
> {
  const db = getDb();
  const rows = await db
    .select({
      policyCarExcessDefaultId: policyCarExcessDefault.policyCarExcessDefaultId,
      excess: policyCarExcessDefault.excess,
    })
    .from(policyCarExcessDefault)
    .orderBy(asc(policyCarExcessDefault.displayOrder));

  if (rows.length === 0) {
    return getReferenceData().defaultExcesses;
  }
  return defaultExcessesFromCatalogue(rows);
}

/** Prefer Postgres `car_wording`; fall back to static catalogue if empty. */
export async function getCarWording(): Promise<CarWording[]> {
  const db = getDb();
  const rows = await db
    .select({
      carWordingId: carWording.carWordingId,
      subject: carWording.subject,
      content: carWording.content,
    })
    .from(carWording)
    .orderBy(asc(carWording.carWordingId));

  if (rows.length === 0) {
    return carWordingData;
  }

  return rows.map((row) => ({
    carWordingId: row.carWordingId,
    subject: row.subject ?? "",
    content: row.content ?? "",
  }));
}
