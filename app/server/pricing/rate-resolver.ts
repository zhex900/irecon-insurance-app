import { and, asc, desc, eq, lte } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import {
  brokerFeeSchedule,
  brokerFeeScheduleLine,
  price,
  priceCar,
  priceEsl,
  priceEslRate,
  pricePlant,
  priceStampDuty,
  priceStampDutyRate,
  priceTerrorism,
  priceTerrorismPostcode,
  priceTerrorismRate,
  state,
} from "~/lib/db/price-schema";
import type {
  ResolvedEsl,
  ResolvedPlant,
  ResolvedPrice,
  ResolvedStampDuty,
  ResolvedTerror,
} from "~/server/pricing/types";

const POLICY_TYPE_CAR = 1;

function num(value: string | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

async function stateIdByCode(code: string): Promise<number | null> {
  const db = getDb();
  const [row] = await db
    .select({ stateId: state.stateId })
    .from(state)
    .where(eq(state.code, code.toUpperCase()))
    .limit(1);
  return row?.stateId ?? null;
}

export async function resolvePrice(
  coverTypeId: number,
  turnover: number,
  date: string,
): Promise<ResolvedPrice | null> {
  const db = getDb();
  const [header] = await db
    .select()
    .from(price)
    .where(
      and(
        eq(price.policyTypeId, POLICY_TYPE_CAR),
        eq(price.published, true),
        lte(price.dateStart, date),
      ),
    )
    .orderBy(desc(price.dateStart))
    .limit(1);
  if (!header) return null;

  const bands = await db
    .select()
    .from(priceCar)
    .where(
      and(
        eq(priceCar.priceId, header.priceId),
        eq(priceCar.coverTypeId, coverTypeId),
      ),
    )
    .orderBy(asc(priceCar.turnoverMin));

  const band = bands.find((item) => {
    const min = num(item.turnoverMin);
    const max = item.turnoverMax == null ? null : num(item.turnoverMax);
    return turnover >= min && (max == null || turnover <= max);
  });
  if (!band) return null;

  return {
    priceId: header.priceId,
    coverTypeId: band.coverTypeId,
    lowerTurnover: num(band.turnoverMin),
    upperTurnover: band.turnoverMax == null ? null : num(band.turnoverMax),
    cwRate: num(band.contractWorksRate),
    cwMinPrem: num(band.contractWorksMinPremium),
    tenMilRate: num(band.liability10mRate),
    tenMilMinPrem: num(band.liability10mMinPremium),
    twentyMilRate: num(band.liability20mRate),
    twentyMilMinPrem: num(band.liability20mMinPremium),
    dateApplied: header.dateStart,
  };
}

export async function resolveStampDuty(
  stateCode: string,
  date: string,
): Promise<ResolvedStampDuty | null> {
  const stateId = await stateIdByCode(stateCode);
  if (stateId == null) return null;

  const db = getDb();
  const [header] = await db
    .select()
    .from(priceStampDuty)
    .where(
      and(
        eq(priceStampDuty.policyTypeId, POLICY_TYPE_CAR),
        eq(priceStampDuty.published, true),
        lte(priceStampDuty.dateStart, date),
      ),
    )
    .orderBy(desc(priceStampDuty.dateStart))
    .limit(1);
  if (!header) return null;

  const [rate] = await db
    .select()
    .from(priceStampDutyRate)
    .where(
      and(
        eq(priceStampDutyRate.priceStampDutyId, header.priceStampDutyId),
        eq(priceStampDutyRate.stateId, stateId),
      ),
    )
    .limit(1);
  if (!rate) return null;

  return {
    priceStampDutyId: header.priceStampDutyId,
    rate: num(rate.rate),
    dateApplied: header.dateStart,
  };
}

export async function resolveEsl(
  stateCode: string,
  date: string,
): Promise<ResolvedEsl | null> {
  const stateId = await stateIdByCode(stateCode);
  if (stateId == null) return null;

  const db = getDb();
  const [header] = await db
    .select()
    .from(priceEsl)
    .where(
      and(
        eq(priceEsl.policyTypeId, POLICY_TYPE_CAR),
        eq(priceEsl.published, true),
        lte(priceEsl.dateStart, date),
      ),
    )
    .orderBy(desc(priceEsl.dateStart))
    .limit(1);
  if (!header) return null;

  const [rate] = await db
    .select()
    .from(priceEslRate)
    .where(
      and(
        eq(priceEslRate.priceEslId, header.priceEslId),
        eq(priceEslRate.stateId, stateId),
      ),
    )
    .limit(1);
  if (!rate) return null;

  return {
    priceEslId: header.priceEslId,
    constructionRate: num(rate.constructionRate),
    plantRate: num(rate.plantRate),
    dateApplied: header.dateStart,
  };
}

export async function resolveTerrorism(
  postcode: string,
  stateCode: string,
  date: string,
): Promise<ResolvedTerror | null> {
  const stateId = await stateIdByCode(stateCode);
  const db = getDb();
  const [header] = await db
    .select()
    .from(priceTerrorism)
    .where(
      and(
        eq(priceTerrorism.policyTypeId, POLICY_TYPE_CAR),
        eq(priceTerrorism.published, true),
        lte(priceTerrorism.dateStart, date),
      ),
    )
    .orderBy(desc(priceTerrorism.dateStart))
    .limit(1);
  if (!header) return null;

  const normalizedPostcode = postcode.trim();
  if (normalizedPostcode && stateId != null) {
    const [hit] = await db
      .select({
        rate: priceTerrorismRate.rate,
        tier: priceTerrorismRate.tier,
      })
      .from(priceTerrorismPostcode)
      .innerJoin(
        priceTerrorismRate,
        eq(
          priceTerrorismPostcode.priceTerrorismRateId,
          priceTerrorismRate.priceTerrorismRateId,
        ),
      )
      .where(
        and(
          eq(priceTerrorismRate.priceTerrorismId, header.priceTerrorismId),
          eq(priceTerrorismPostcode.postcode, normalizedPostcode),
          eq(priceTerrorismPostcode.stateId, stateId),
        ),
      )
      .limit(1);
    if (hit) {
      return { rate: num(hit.rate), tier: hit.tier };
    }
  }

  // Fallback tier C when postcode not listed (matches previous JSON resolver behaviour).
  return { rate: 0.01, tier: `${stateCode}-default` };
}

export async function resolvePlantRate(
  date: string,
): Promise<ResolvedPlant | null> {
  const db = getDb();
  const [header] = await db
    .select()
    .from(pricePlant)
    .where(
      and(
        eq(pricePlant.policyTypeId, POLICY_TYPE_CAR),
        eq(pricePlant.published, true),
        lte(pricePlant.dateStart, date),
      ),
    )
    .orderBy(desc(pricePlant.dateStart))
    .limit(1);
  if (!header) return null;

  return {
    pricePlantId: header.pricePlantId,
    rate: num(header.rate),
    plantMinValue: num(header.plantMinValue),
    plantMaxValue: num(header.plantMaxValue),
    dateApplied: header.dateStart,
  };
}

export async function resolveBrokerFeeTotal(date: string): Promise<number> {
  const db = getDb();
  const [sched] = await db
    .select()
    .from(brokerFeeSchedule)
    .where(
      and(
        eq(brokerFeeSchedule.policyTypeId, POLICY_TYPE_CAR),
        eq(brokerFeeSchedule.published, true),
        lte(brokerFeeSchedule.dateStart, date),
      ),
    )
    .orderBy(desc(brokerFeeSchedule.dateStart))
    .limit(1);
  if (!sched) return 0;

  const lines = await db
    .select()
    .from(brokerFeeScheduleLine)
    .where(
      eq(brokerFeeScheduleLine.brokerFeeScheduleId, sched.brokerFeeScheduleId),
    );
  return lines.reduce((sum, line) => sum + num(line.fee) + num(line.feeGst), 0);
}
