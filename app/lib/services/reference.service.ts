import { asc } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { policyCarExcessDefault } from "~/lib/db/schema";
import type { CarWording, ReferenceData } from "~/lib/db/types";
import { defaultExcessesFromCatalogue } from "~/lib/policies/excesses";
import { referenceData } from "~/lib/reference-data";
import { listAccountManagers } from "~/lib/services/account-managers/service";
import { listAuthorisedRepresentatives } from "~/lib/services/authorised-representatives/service";
import { listCarWordings } from "~/lib/services/car-wording/service";
import { resolveBrokerFeeLines } from "~/server/pricing/rate-resolver";

export type ListReferenceData = Pick<
  ReferenceData,
  "accountManagers" | "wholesaleBrokers"
>;

export function getReferenceData(): ReferenceData {
  return referenceData;
}

/** Live account managers + ARs only — for list page filters (not full reference payload). */
export async function getListReferenceAsync(): Promise<ListReferenceData> {
  const accountManagers = await listAccountManagers();
  const wholesaleBrokers = await listAuthorisedRepresentatives();
  return { accountManagers, wholesaleBrokers };
}

/** Live broker fee schedule lines for premium breakdown (as-of policy inception). */
export async function getFeeNamesAsync(
  feeAsOfDate?: string,
): Promise<ReferenceData["feeNames"]> {
  const asOf = feeAsOfDate ?? new Date().toISOString().slice(0, 10);
  return resolveBrokerFeeLines(asOf);
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
