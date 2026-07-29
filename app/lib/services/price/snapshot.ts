/**
 * Pricing catalogue loaders for Settings → Prices.
 */
import { asc } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import {
  brokerFeeSchedule,
  brokerFeeScheduleLine,
  coverType,
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
import { num } from "./helpers";
import type { PriceCatalogueSnapshot } from "./types";

export async function getPriceCatalogueSnapshot(): Promise<PriceCatalogueSnapshot> {
  const db = getDb();

  // Batch queries — Workers postgres pools are small (max ~5). A single
  // Promise.all of 14 selects can stall the pool and hang the route loader.
  const [coverTypes, states] = await Promise.all([
    db.select().from(coverType).orderBy(asc(coverType.coverTypeId)),
    db.select().from(state).orderBy(asc(state.stateId)),
  ]);

  const [priceHeaders, carBands] = await Promise.all([
    db.select().from(price).orderBy(asc(price.dateStart), asc(price.priceId)),
    db
      .select()
      .from(priceCar)
      .orderBy(
        asc(priceCar.priceId),
        asc(priceCar.coverTypeId),
        asc(priceCar.turnoverMin),
      ),
  ]);

  const [sdHeaders, sdRates] = await Promise.all([
    db.select().from(priceStampDuty).orderBy(asc(priceStampDuty.dateStart)),
    db.select().from(priceStampDutyRate),
  ]);

  const [eslHeaders, eslRates] = await Promise.all([
    db.select().from(priceEsl).orderBy(asc(priceEsl.dateStart)),
    db.select().from(priceEslRate),
  ]);

  const plantRows = await db
    .select()
    .from(pricePlant)
    .orderBy(asc(pricePlant.dateStart));

  const [terrorHeaders, terrorRates, terrorPostcodes] = await Promise.all([
    db.select().from(priceTerrorism).orderBy(asc(priceTerrorism.dateStart)),
    db.select().from(priceTerrorismRate),
    db.select().from(priceTerrorismPostcode),
  ]);

  const [feeHeaders, feeLines] = await Promise.all([
    db
      .select()
      .from(brokerFeeSchedule)
      .orderBy(asc(brokerFeeSchedule.dateStart)),
    db
      .select()
      .from(brokerFeeScheduleLine)
      .orderBy(
        asc(brokerFeeScheduleLine.brokerFeeScheduleId),
        asc(brokerFeeScheduleLine.sortOrder),
      ),
  ]);

  const coverName = new Map(
    coverTypes.map((c) => [c.coverTypeId, c.name] as const),
  );
  const stateById = new Map(states.map((s) => [s.stateId, s] as const));

  const car = priceHeaders.map((header) => ({
    priceId: header.priceId,
    dateStart: header.dateStart,
    published: header.published,
    createdBy: header.createdBy,
    bands: carBands
      .filter((b) => b.priceId === header.priceId)
      .map((b) => ({
        coverTypeId: b.coverTypeId,
        coverTypeName: coverName.get(b.coverTypeId) ?? String(b.coverTypeId),
        turnoverMin: num(b.turnoverMin),
        turnoverMax: b.turnoverMax == null ? null : num(b.turnoverMax),
        contractWorksRate: num(b.contractWorksRate),
        contractWorksMinPremium: num(b.contractWorksMinPremium),
        liability10mRate: num(b.liability10mRate),
        liability10mMinPremium: num(b.liability10mMinPremium),
        liability20mRate: num(b.liability20mRate),
        liability20mMinPremium: num(b.liability20mMinPremium),
      })),
  }));

  const stampDuty = sdHeaders.map((header) => ({
    priceStampDutyId: header.priceStampDutyId,
    dateStart: header.dateStart,
    published: header.published,
    rates: sdRates
      .filter((r) => r.priceStampDutyId === header.priceStampDutyId)
      .map((r) => {
        const st = stateById.get(r.stateId);
        return {
          stateCode: st?.code ?? String(r.stateId),
          stateName: st?.name ?? "",
          rate: num(r.rate),
        };
      })
      .sort((a, b) => a.stateCode.localeCompare(b.stateCode)),
  }));

  const esl = eslHeaders.map((header) => ({
    priceEslId: header.priceEslId,
    dateStart: header.dateStart,
    published: header.published,
    rates: eslRates
      .filter((r) => r.priceEslId === header.priceEslId)
      .map((r) => {
        const st = stateById.get(r.stateId);
        return {
          stateCode: st?.code ?? String(r.stateId),
          stateName: st?.name ?? "",
          constructionRate: num(r.constructionRate),
          plantRate: num(r.plantRate),
        };
      })
      .sort((a, b) => a.stateCode.localeCompare(b.stateCode)),
  }));

  const plant = plantRows.map((row) => ({
    pricePlantId: row.pricePlantId,
    dateStart: row.dateStart,
    published: row.published,
    rate: num(row.rate),
    plantMinValue: num(row.plantMinValue),
    plantMaxValue: num(row.plantMaxValue),
  }));

  const postcodesByRate = new Map<
    number,
    Array<{
      postcode: string;
      stateId: number;
      stateCode: string;
      stateName: string;
    }>
  >();
  for (const pc of terrorPostcodes) {
    const st = stateById.get(pc.stateId);
    const list = postcodesByRate.get(pc.priceTerrorismRateId) ?? [];
    list.push({
      postcode: pc.postcode,
      stateId: pc.stateId,
      stateCode: st?.code ?? String(pc.stateId),
      stateName: st?.name ?? "",
    });
    postcodesByRate.set(pc.priceTerrorismRateId, list);
  }
  for (const list of postcodesByRate.values()) {
    list.sort((a, b) => {
      const byState = a.stateCode.localeCompare(b.stateCode);
      if (byState !== 0) return byState;
      return a.postcode.localeCompare(b.postcode);
    });
  }

  const terrorism = terrorHeaders.map((header) => ({
    priceTerrorismId: header.priceTerrorismId,
    dateStart: header.dateStart,
    published: header.published,
    tiers: terrorRates
      .filter((r) => r.priceTerrorismId === header.priceTerrorismId)
      .map((r) => ({
        priceTerrorismRateId: r.priceTerrorismRateId,
        tier: r.tier,
        rate: num(r.rate),
        postcodes: postcodesByRate.get(r.priceTerrorismRateId) ?? [],
      })),
  }));

  const brokerFees = feeHeaders.map((header) => ({
    brokerFeeScheduleId: header.brokerFeeScheduleId,
    dateStart: header.dateStart,
    published: header.published,
    lines: feeLines
      .filter((l) => l.brokerFeeScheduleId === header.brokerFeeScheduleId)
      .map((l) => ({
        sortOrder: l.sortOrder,
        name: l.name,
        fee: num(l.fee),
        feeGst: num(l.feeGst),
      })),
  }));

  return {
    coverTypes: coverTypes.map((c) => ({
      coverTypeId: c.coverTypeId,
      name: c.name,
    })),
    states: states.map((s) => ({
      stateId: s.stateId,
      code: s.code,
      name: s.name,
    })),
    car,
    stampDuty,
    esl,
    plant,
    terrorism,
    brokerFees,
  };
}
