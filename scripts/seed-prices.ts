/**
 * Seed Price* / BrokerFeeSchedule* tables from _archive/data/prices.json (+ reference feeNames fallback).
 *
 * Usage:
 *   npm run db:seed:prices
 *   npx tsx --env-file=.env scripts/seed-prices.mts
 *   npx tsx --env-file=.env.staging scripts/seed-prices.mts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb } from "../app/lib/db/client";
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
} from "../app/lib/db/price-schema";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(name: string): T {
  return JSON.parse(
    readFileSync(join(root, "_archive/data", name), "utf8"),
  ) as T;
}

type TerrorPostcode =
  | string
  | {
      postcode: string;
      stateCode?: string;
    };

type PricesFile = {
  prices: Array<{
    priceId: number;
    dateStart: string;
    published?: boolean;
    bands: Array<{
      coverTypeId: number;
      lowerTO: number;
      upperTO: number | null;
      cwRate: number;
      cwMinPrem: number;
      tenMilRate: number;
      tenMilMinPrem: number;
      twentyMilRate: number;
      twentyMilMinPrem: number;
    }>;
  }>;
  stampDuty: Array<{
    priceStampDutyId: number;
    dateStart: string;
    published?: boolean;
    rates: Array<{ stateCode: string; rate: number }>;
  }>;
  esl: Array<{
    priceEslId: number;
    dateStart: string;
    published?: boolean;
    rates: Array<{
      stateCode: string;
      constructionRate: number;
      plantRate: number;
    }>;
  }>;
  terror: Array<{
    priceTerrorismId: number;
    dateStart: string;
    published?: boolean;
    tiers: Array<{
      tier: string;
      rate: number;
      postcodes: TerrorPostcode[];
    }>;
  }>;
  plant: Array<{
    pricePlantId: number;
    dateStart: string;
    published?: boolean;
    rate: number;
    plantMinValue: number;
    plantMaxValue: number;
  }>;
  brokerFees?: Array<{
    dateStart: string;
    published?: boolean;
    lines: Array<{
      sortOrder: number;
      name: string;
      fee: number;
      feeGst: number;
    }>;
  }>;
};

/** Best-effort AU postcode → state_id (matches seeded public.state). */
function stateIdForPostcode(postcode: string): number {
  const n = Number(postcode);
  if (!Number.isFinite(n)) return 2; // NSW fallback
  if (n >= 800 && n < 1000) return 3; // NT
  if (n >= 200 && n < 300) return 1; // ACT (0200s rare)
  if (n >= 2600 && n < 2620) return 1; // ACT
  if (n >= 2000 && n < 3000) return 2; // NSW
  if (n >= 3000 && n < 4000) return 7; // VIC
  if (n >= 4000 && n < 5000) return 4; // QLD
  if (n >= 5000 && n < 6000) return 5; // SA
  if (n >= 6000 && n < 7000) return 8; // WA
  if (n >= 7000 && n < 8000) return 6; // TAS
  return 2;
}

function normalizePostcode(entry: TerrorPostcode): {
  postcode: string;
  stateCode?: string;
} {
  if (typeof entry === "string") return { postcode: entry.trim() };
  return {
    postcode: String(entry.postcode ?? "").trim(),
    stateCode: entry.stateCode?.trim().toUpperCase(),
  };
}

export async function seedPrices() {
  const db = getDb();
  const data = readJson<PricesFile>("prices.json");
  const reference = readJson<{
    feeNames: Array<{
      name: string;
      sortOrder: number;
      fee: number;
      feeGst: number;
    }>;
  }>("reference.json");

  const states = await db.select().from(state);
  const stateIdByCode = new Map(
    states.map((row) => [row.code.toUpperCase(), row.stateId]),
  );

  console.log("Clearing price catalogues…");
  await db.execute(sql`
    TRUNCATE TABLE
      price_terrorism_postcode,
      price_terrorism_rate,
      price_terrorism,
      price_stamp_duty_rate,
      price_stamp_duty,
      price_esl_rate,
      price_esl,
      price_plant,
      price_car,
      price,
      broker_fee_schedule_line,
      broker_fee_schedule
    RESTART IDENTITY CASCADE
  `);

  for (const header of data.prices) {
    const published = header.published ?? true;
    await db.insert(price).values({
      priceId: header.priceId,
      policyTypeId: 1,
      dateStart: header.dateStart,
      published,
      datePublished: published ? new Date(header.dateStart) : null,
      createdBy: "seed:prices",
    });
    for (const band of header.bands) {
      await db.insert(priceCar).values({
        priceId: header.priceId,
        coverTypeId: band.coverTypeId,
        turnoverMin: String(band.lowerTO),
        turnoverMax: band.upperTO == null ? null : String(band.upperTO),
        contractWorksRate: String(band.cwRate ?? 0),
        contractWorksMinPremium: String(band.cwMinPrem ?? 0),
        liability10mRate: String(band.tenMilRate ?? 0),
        liability10mMinPremium: String(band.tenMilMinPrem ?? 0),
        liability20mRate: String(band.twentyMilRate ?? 0),
        liability20mMinPremium: String(band.twentyMilMinPrem ?? 0),
      });
    }
  }

  for (const header of data.stampDuty) {
    const published = header.published ?? true;
    await db.insert(priceStampDuty).values({
      priceStampDutyId: header.priceStampDutyId,
      policyTypeId: 1,
      dateStart: header.dateStart,
      published,
      datePublished: published ? new Date(header.dateStart) : null,
      createdBy: "seed:prices",
    });
    for (const rate of header.rates) {
      const stateId = stateIdByCode.get(rate.stateCode.toUpperCase());
      if (stateId == null) continue;
      await db.insert(priceStampDutyRate).values({
        priceStampDutyId: header.priceStampDutyId,
        stateId,
        rate: String(rate.rate ?? 0),
      });
    }
  }

  for (const header of data.esl) {
    const published = header.published ?? true;
    await db.insert(priceEsl).values({
      priceEslId: header.priceEslId,
      policyTypeId: 1,
      dateStart: header.dateStart,
      published,
      datePublished: published ? new Date(header.dateStart) : null,
      createdBy: "seed:prices",
    });
    for (const rate of header.rates) {
      const stateId = stateIdByCode.get(rate.stateCode.toUpperCase());
      if (stateId == null) continue;
      await db.insert(priceEslRate).values({
        priceEslId: header.priceEslId,
        stateId,
        constructionRate: String(rate.constructionRate ?? 0),
        plantRate: String(rate.plantRate ?? 0),
      });
    }
  }

  for (const header of data.terror) {
    const published = header.published ?? true;
    await db.insert(priceTerrorism).values({
      priceTerrorismId: header.priceTerrorismId,
      policyTypeId: 1,
      dateStart: header.dateStart,
      published,
      datePublished: published ? new Date(header.dateStart) : null,
      createdBy: "seed:prices",
    });
    for (const tier of header.tiers) {
      const [rateRow] = await db
        .insert(priceTerrorismRate)
        .values({
          priceTerrorismId: header.priceTerrorismId,
          tier: tier.tier,
          rate: String(tier.rate ?? 0),
        })
        .returning();
      for (const entry of tier.postcodes) {
        const { postcode, stateCode } = normalizePostcode(entry);
        if (!postcode) continue;
        const stateId =
          (stateCode ? stateIdByCode.get(stateCode) : undefined) ??
          stateIdForPostcode(postcode);
        await db.insert(priceTerrorismPostcode).values({
          priceTerrorismRateId: rateRow.priceTerrorismRateId,
          postcode,
          stateId,
        });
      }
    }
  }

  for (const header of data.plant) {
    const published = header.published ?? true;
    await db.insert(pricePlant).values({
      pricePlantId: header.pricePlantId,
      policyTypeId: 1,
      rate: String(header.rate ?? 0),
      plantMinValue: String(header.plantMinValue ?? 0),
      plantMaxValue: String(header.plantMaxValue ?? 0),
      dateStart: header.dateStart,
      published,
      datePublished: published ? new Date(header.dateStart) : null,
      createdBy: "seed:prices",
    });
  }

  const feeSchedules =
    data.brokerFees && data.brokerFees.length > 0
      ? data.brokerFees
      : [
          {
            dateStart: "2025-01-01",
            published: true,
            lines: reference.feeNames,
          },
        ];

  for (const schedule of feeSchedules) {
    const published = schedule.published ?? true;
    const [feeHeader] = await db
      .insert(brokerFeeSchedule)
      .values({
        policyTypeId: 1,
        dateStart: schedule.dateStart,
        published,
        datePublished: published ? new Date(schedule.dateStart) : null,
        createdBy: "seed:prices",
      })
      .returning();

    for (const fee of schedule.lines) {
      await db.insert(brokerFeeScheduleLine).values({
        brokerFeeScheduleId: feeHeader.brokerFeeScheduleId,
        sortOrder: fee.sortOrder,
        name: fee.name,
        fee: String(fee.fee ?? 0),
        feeGst: String(fee.feeGst ?? 0),
      });
    }
  }

  await db.execute(sql`
    SELECT setval(pg_get_serial_sequence('price', 'price_id'),
      (SELECT COALESCE(MAX(price_id), 1) FROM price));
    SELECT setval(pg_get_serial_sequence('price_esl', 'price_esl_id'),
      (SELECT COALESCE(MAX(price_esl_id), 1) FROM price_esl));
    SELECT setval(pg_get_serial_sequence('price_plant', 'price_plant_id'),
      (SELECT COALESCE(MAX(price_plant_id), 1) FROM price_plant));
    SELECT setval(pg_get_serial_sequence('price_stamp_duty', 'price_stamp_duty_id'),
      (SELECT COALESCE(MAX(price_stamp_duty_id), 1) FROM price_stamp_duty));
    SELECT setval(pg_get_serial_sequence('price_terrorism', 'price_terrorism_id'),
      (SELECT COALESCE(MAX(price_terrorism_id), 1) FROM price_terrorism));
    SELECT setval(pg_get_serial_sequence('broker_fee_schedule', 'broker_fee_schedule_id'),
      (SELECT COALESCE(MAX(broker_fee_schedule_id), 1) FROM broker_fee_schedule));
  `);

  const feeLineCount = feeSchedules.reduce(
    (sum, schedule) => sum + schedule.lines.length,
    0,
  );
  console.log(
    `Seeded prices: ${data.prices.length} price file(s), ${data.stampDuty.length} stamp duty, ${data.esl.length} ESL, ${data.terror.length} terror, ${data.plant.length} plant, ${feeSchedules.length} fee schedule(s) / ${feeLineCount} lines`,
  );
}
