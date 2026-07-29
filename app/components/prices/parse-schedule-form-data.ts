import type { PriceCatalogueKind } from "~/lib/services/price";
import { percentToRate } from "~/lib/utils";

/** Parse schedule update payload from the UI form fields. */
export function parseScheduleFormData(
  kind: PriceCatalogueKind,
  formData: FormData,
): unknown {
  const dateStart = String(formData.get("dateStart") ?? "");
  const published = formData.get("published") === "true";

  switch (kind) {
    case "car": {
      const bandCount = Number(formData.get("bandCount") ?? 0);
      const bands = [];
      for (let i = 0; i < bandCount; i++) {
        const maxRaw = String(
          formData.get(`band_${i}_turnoverMax`) ?? "",
        ).trim();
        bands.push({
          coverTypeId: Number(formData.get(`band_${i}_coverTypeId`)),
          turnoverMin: Number(formData.get(`band_${i}_turnoverMin`)),
          turnoverMax: maxRaw === "" ? null : Number(maxRaw),
          // UI edits percent; storage is decimal fraction.
          contractWorksRate: percentToRate(
            Number(formData.get(`band_${i}_contractWorksRatePercent`)),
          ),
          contractWorksMinPremium: Number(
            formData.get(`band_${i}_contractWorksMinPremium`),
          ),
          liability10mRate: percentToRate(
            Number(formData.get(`band_${i}_liability10mRatePercent`)),
          ),
          liability10mMinPremium: Number(
            formData.get(`band_${i}_liability10mMinPremium`),
          ),
          liability20mRate: percentToRate(
            Number(formData.get(`band_${i}_liability20mRatePercent`)),
          ),
          liability20mMinPremium: Number(
            formData.get(`band_${i}_liability20mMinPremium`),
          ),
        });
      }
      return { dateStart, published, bands };
    }
    case "stamp": {
      const rateCount = Number(formData.get("rateCount") ?? 0);
      const rates = [];
      for (let i = 0; i < rateCount; i++) {
        rates.push({
          stateCode: String(formData.get(`rate_${i}_stateCode`) ?? ""),
          rate: percentToRate(Number(formData.get(`rate_${i}_ratePercent`))),
        });
      }
      return { dateStart, published, rates };
    }
    case "esl": {
      const rateCount = Number(formData.get("rateCount") ?? 0);
      const rates = [];
      for (let i = 0; i < rateCount; i++) {
        rates.push({
          stateCode: String(formData.get(`rate_${i}_stateCode`) ?? ""),
          constructionRate: percentToRate(
            Number(formData.get(`rate_${i}_constructionRatePercent`)),
          ),
          plantRate: percentToRate(
            Number(formData.get(`rate_${i}_plantRatePercent`)),
          ),
        });
      }
      return { dateStart, published, rates };
    }
    case "plant":
      return {
        dateStart,
        published,
        rate: percentToRate(Number(formData.get("ratePercent"))),
        plantMinValue: Number(formData.get("plantMinValue")),
        plantMaxValue: Number(formData.get("plantMaxValue")),
      };
    case "terror": {
      const tierCount = Number(formData.get("tierCount") ?? 0);
      const tiers: Array<{
        tier: string;
        rate: number;
        postcodes: Array<{ postcode: string; stateCode: string }>;
      }> = [];
      for (let i = 0; i < tierCount; i++) {
        tiers.push({
          tier: String(formData.get(`tier_${i}_tier`) ?? ""),
          // UI edits percent; storage is decimal fraction.
          rate: percentToRate(Number(formData.get(`tier_${i}_ratePercent`))),
          postcodes: [],
        });
      }

      // One row per price_terrorism_postcode: postcode,stateCode,tier
      const raw = String(formData.get("postcodesCsv") ?? "");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const parts = trimmed.split(/[,\t]/).map((p) => p.trim());
        if (parts.length < 3) {
          throw new Error(
            `Invalid postcode row "${trimmed}". Use postcode,state,tier`,
          );
        }
        const [postcode, stateCode, tierName] = parts;
        const tier = tiers.find(
          (t) => t.tier.trim().toUpperCase() === tierName.toUpperCase(),
        );
        if (!tier) {
          throw new Error(
            `Postcode ${postcode} references unknown tier "${tierName}"`,
          );
        }
        tier.postcodes.push({
          postcode,
          stateCode: stateCode.toUpperCase(),
        });
      }
      return { dateStart, published, tiers };
    }
    case "fees": {
      const lineCount = Number(formData.get("lineCount") ?? 0);
      const lines = [];
      for (let i = 0; i < lineCount; i++) {
        lines.push({
          sortOrder: Number(formData.get(`line_${i}_sortOrder`)),
          name: String(formData.get(`line_${i}_name`) ?? ""),
          fee: Number(formData.get(`line_${i}_fee`)),
          feeGst: Number(formData.get(`line_${i}_feeGst`)),
        });
      }
      return { dateStart, published, lines };
    }
  }
}
