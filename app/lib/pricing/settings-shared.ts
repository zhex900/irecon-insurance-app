/**
 * Shared helpers for Settings → Prices nested routes.
 */
import { catalogueLabel } from "~/lib/services/price/labels";
import type {
  PriceCatalogueKind,
  PriceCatalogueSnapshot,
} from "~/lib/services/price/types";

export const PRICE_CATALOGUE_SLUGS = [
  "car-rates",
  "stamp-duty",
  "esl",
  "plant",
  "terrorism",
  "broker-fees",
] as const;

export type PriceCatalogueSlug = (typeof PRICE_CATALOGUE_SLUGS)[number];

export function isPriceCatalogueSlug(
  value: string,
): value is PriceCatalogueSlug {
  return (PRICE_CATALOGUE_SLUGS as readonly string[]).includes(value);
}

export function slugToKind(slug: PriceCatalogueSlug): PriceCatalogueKind {
  switch (slug) {
    case "car-rates":
      return "car";
    case "stamp-duty":
      return "stamp";
    case "esl":
      return "esl";
    case "plant":
      return "plant";
    case "terrorism":
      return "terror";
    case "broker-fees":
      return "fees";
  }
}

export function kindToSlug(kind: PriceCatalogueKind): PriceCatalogueSlug {
  switch (kind) {
    case "car":
      return "car-rates";
    case "stamp":
      return "stamp-duty";
    case "esl":
      return "esl";
    case "plant":
      return "plant";
    case "terror":
      return "terrorism";
    case "fees":
      return "broker-fees";
  }
}

export function pricesListHref(slug: PriceCatalogueSlug) {
  return `/settings/prices/${slug}`;
}

export function pricesNewHref(slug: PriceCatalogueSlug) {
  return `/settings/prices/${slug}/new`;
}

export function pricesItemHref(slug: PriceCatalogueSlug, id: number) {
  return `/settings/prices/${slug}/${id}`;
}

export function pricesEditHref(slug: PriceCatalogueSlug, id: number) {
  return `${pricesItemHref(slug, id)}?edit=1`;
}

export function pricesDeleteHref(slug: PriceCatalogueSlug, id: number) {
  return `${pricesItemHref(slug, id)}?delete=1`;
}

/** @deprecated Prefer pricesItemHref / pricesEditHref / pricesDeleteHref */
export function pricesViewHref(slug: PriceCatalogueSlug, id: number) {
  return pricesItemHref(slug, id);
}

/** @deprecated Prefer pricesEditHref */
export function pricesViewEditHref(slug: PriceCatalogueSlug, id: number) {
  return pricesEditHref(slug, id);
}

/** @deprecated Prefer pricesDeleteHref */
export function pricesViewDeleteHref(slug: PriceCatalogueSlug, id: number) {
  return pricesDeleteHref(slug, id);
}

export function emptyCatalogue(): PriceCatalogueSnapshot {
  return {
    coverTypes: [],
    states: [],
    car: [],
    stampDuty: [],
    esl: [],
    plant: [],
    terrorism: [],
    brokerFees: [],
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function createTemplate(
  kind: PriceCatalogueKind,
  snapshot: PriceCatalogueSnapshot,
): string {
  switch (kind) {
    case "car": {
      const latest = snapshot.car.at(-1);
      if (latest) {
        return pretty({
          dateStart: todayIsoDate(),
          published: false,
          bands: latest.bands.map((b) => ({
            coverTypeId: b.coverTypeId,
            turnoverMin: b.turnoverMin,
            turnoverMax: b.turnoverMax,
            contractWorksRate: b.contractWorksRate,
            contractWorksMinPremium: b.contractWorksMinPremium,
            liability10mRate: b.liability10mRate,
            liability10mMinPremium: b.liability10mMinPremium,
            liability20mRate: b.liability20mRate,
            liability20mMinPremium: b.liability20mMinPremium,
          })),
        });
      }
      return pretty({
        dateStart: todayIsoDate(),
        published: false,
        bands: snapshot.coverTypes.map((ct) => ({
          coverTypeId: ct.coverTypeId,
          turnoverMin: 0,
          turnoverMax: null,
          contractWorksRate: 0,
          contractWorksMinPremium: 0,
          liability10mRate: 0,
          liability10mMinPremium: 0,
          liability20mRate: 0,
          liability20mMinPremium: 0,
        })),
      });
    }
    case "stamp": {
      const latest = snapshot.stampDuty.at(-1);
      if (latest) {
        return pretty({
          dateStart: todayIsoDate(),
          published: false,
          rates: latest.rates.map((r) => ({
            stateCode: r.stateCode,
            rate: r.rate,
          })),
        });
      }
      return pretty({
        dateStart: todayIsoDate(),
        published: false,
        rates: snapshot.states.map((s) => ({
          stateCode: s.code,
          rate: 0,
        })),
      });
    }
    case "esl": {
      const latest = snapshot.esl.at(-1);
      if (latest) {
        return pretty({
          dateStart: todayIsoDate(),
          published: false,
          rates: latest.rates.map((r) => ({
            stateCode: r.stateCode,
            constructionRate: r.constructionRate,
            plantRate: r.plantRate,
          })),
        });
      }
      return pretty({
        dateStart: todayIsoDate(),
        published: false,
        rates: snapshot.states.map((s) => ({
          stateCode: s.code,
          constructionRate: 0,
          plantRate: 0,
        })),
      });
    }
    case "plant": {
      const latest = snapshot.plant.at(-1);
      if (latest) {
        return pretty({
          dateStart: todayIsoDate(),
          published: false,
          rate: latest.rate,
          plantMinValue: latest.plantMinValue,
          plantMaxValue: latest.plantMaxValue,
        });
      }
      return pretty({
        dateStart: todayIsoDate(),
        published: false,
        rate: 0,
        plantMinValue: 0,
        plantMaxValue: 0,
      });
    }
    case "terror": {
      const latest = snapshot.terrorism.at(-1);
      if (latest) {
        return pretty({
          dateStart: todayIsoDate(),
          published: false,
          tiers: latest.tiers.map((t) => ({
            tier: t.tier,
            rate: t.rate,
            postcodes: t.postcodes.map((p) => ({
              postcode: p.postcode,
              stateCode: p.stateCode,
            })),
          })),
        });
      }
      return pretty({
        dateStart: todayIsoDate(),
        published: false,
        tiers: [{ tier: "A", rate: 0, postcodes: [] }],
      });
    }
    case "fees": {
      const latest = snapshot.brokerFees.at(-1);
      if (latest) {
        return pretty({
          dateStart: todayIsoDate(),
          published: false,
          lines: latest.lines,
        });
      }
      return pretty({
        dateStart: todayIsoDate(),
        published: false,
        lines: [{ sortOrder: 1, name: "Broker fee", fee: 0, feeGst: 0 }],
      });
    }
  }
}

export function payloadFromExisting(
  kind: PriceCatalogueKind,
  snapshot: PriceCatalogueSnapshot,
  id: number,
): string | null {
  switch (kind) {
    case "car": {
      const row = snapshot.car.find((r) => Number(r.priceId) === Number(id));
      if (!row) return null;
      return pretty({
        dateStart: row.dateStart,
        published: row.published,
        bands: row.bands.map((b) => ({
          coverTypeId: b.coverTypeId,
          turnoverMin: b.turnoverMin,
          turnoverMax: b.turnoverMax,
          contractWorksRate: b.contractWorksRate,
          contractWorksMinPremium: b.contractWorksMinPremium,
          liability10mRate: b.liability10mRate,
          liability10mMinPremium: b.liability10mMinPremium,
          liability20mRate: b.liability20mRate,
          liability20mMinPremium: b.liability20mMinPremium,
        })),
      });
    }
    case "stamp": {
      const row = snapshot.stampDuty.find(
        (r) => Number(r.priceStampDutyId) === Number(id),
      );
      if (!row) return null;
      return pretty({
        dateStart: row.dateStart,
        published: row.published,
        rates: row.rates.map((r) => ({
          stateCode: r.stateCode,
          rate: r.rate,
        })),
      });
    }
    case "esl": {
      const row = snapshot.esl.find((r) => Number(r.priceEslId) === Number(id));
      if (!row) return null;
      return pretty({
        dateStart: row.dateStart,
        published: row.published,
        rates: row.rates.map((r) => ({
          stateCode: r.stateCode,
          constructionRate: r.constructionRate,
          plantRate: r.plantRate,
        })),
      });
    }
    case "plant": {
      const row = snapshot.plant.find(
        (r) => Number(r.pricePlantId) === Number(id),
      );
      if (!row) return null;
      return pretty({
        dateStart: row.dateStart,
        published: row.published,
        rate: row.rate,
        plantMinValue: row.plantMinValue,
        plantMaxValue: row.plantMaxValue,
      });
    }
    case "terror": {
      const row = snapshot.terrorism.find(
        (r) => Number(r.priceTerrorismId) === Number(id),
      );
      if (!row) return null;
      return pretty({
        dateStart: row.dateStart,
        published: row.published,
        tiers: row.tiers.map((t) => ({
          tier: t.tier,
          rate: t.rate,
          postcodes: t.postcodes.map((p) => ({
            postcode: p.postcode,
            stateCode: p.stateCode,
          })),
        })),
      });
    }
    case "fees": {
      const row = snapshot.brokerFees.find(
        (r) => Number(r.brokerFeeScheduleId) === Number(id),
      );
      if (!row) return null;
      return pretty({
        dateStart: row.dateStart,
        published: row.published,
        lines: row.lines,
      });
    }
  }
}

export function slugLabel(slug: PriceCatalogueSlug) {
  return catalogueLabel(slugToKind(slug));
}

export function scheduleViewFromSnapshot(
  kind: PriceCatalogueKind,
  snapshot: PriceCatalogueSnapshot,
  id: number,
) {
  switch (kind) {
    case "car": {
      const row = snapshot.car.find((r) => Number(r.priceId) === Number(id));
      if (!row) return null;
      return {
        kind: "car" as const,
        dateStart: row.dateStart,
        published: row.published,
        createdBy: row.createdBy,
        bands: row.bands,
      };
    }
    case "stamp": {
      const row = snapshot.stampDuty.find(
        (r) => Number(r.priceStampDutyId) === Number(id),
      );
      if (!row) return null;
      return {
        kind: "stamp" as const,
        dateStart: row.dateStart,
        published: row.published,
        rates: row.rates,
      };
    }
    case "esl": {
      const row = snapshot.esl.find((r) => Number(r.priceEslId) === Number(id));
      if (!row) return null;
      return {
        kind: "esl" as const,
        dateStart: row.dateStart,
        published: row.published,
        rates: row.rates,
      };
    }
    case "plant": {
      const row = snapshot.plant.find(
        (r) => Number(r.pricePlantId) === Number(id),
      );
      if (!row) return null;
      return {
        kind: "plant" as const,
        dateStart: row.dateStart,
        published: row.published,
        rate: row.rate,
        plantMinValue: row.plantMinValue,
        plantMaxValue: row.plantMaxValue,
      };
    }
    case "terror": {
      const row = snapshot.terrorism.find(
        (r) => Number(r.priceTerrorismId) === Number(id),
      );
      if (!row) return null;
      return {
        kind: "terror" as const,
        dateStart: row.dateStart,
        published: row.published,
        tiers: row.tiers,
      };
    }
    case "fees": {
      const row = snapshot.brokerFees.find(
        (r) => Number(r.brokerFeeScheduleId) === Number(id),
      );
      if (!row) return null;
      return {
        kind: "fees" as const,
        dateStart: row.dateStart,
        published: row.published,
        lines: row.lines,
      };
    }
  }
}
