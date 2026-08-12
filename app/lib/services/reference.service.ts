import { asc } from "drizzle-orm";
import { referenceData } from "~/lib/reference-data";
import { getDb } from "~/lib/db/client";
import { policyCarExcessDefault } from "~/lib/db/schema";
import { defaultExcessesFromCatalogue } from "~/lib/policies/excesses";
import { listAccountManagers } from "~/lib/services/account-managers/service";
import { listAuthorisedRepresentatives } from "~/lib/services/authorised-representatives/service";
import { listCarWordings } from "~/lib/services/car-wording/service";
import type { CarWording, ReferenceData } from "~/lib/db/types";
import { resolveBrokerFeeLines } from "~/server/pricing/rate-resolver";

export function getReferenceData(): ReferenceData {
  return referenceData;
}

/** Reference data with live account managers, ARs, excess defaults, and broker fee schedule from the DB. */
export async function getReferenceDataAsync(
  feeAsOfDate?: string,
): Promise<ReferenceData> {
  const asOf = feeAsOfDate ?? new Date().toISOString().slice(0, 10);
  const [accountManagers, wholesaleBrokers, defaultExcesses, feeNames] =
    await Promise.all([
      listAccountManagers(),
      listAuthorisedRepresentatives(),
      getDefaultExcesses(),
      resolveBrokerFeeLines(asOf),
    ]);
  return {
    ...getReferenceData(),
    accountManagers,
    wholesaleBrokers,
    defaultExcesses,
    feeNames,
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

/** Postgres `car_wording` catalogue (Settings → Additional Wording). */
export async function getCarWording(): Promise<CarWording[]> {
  return listCarWordings();
}
