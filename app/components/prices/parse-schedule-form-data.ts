import type { PriceCatalogueKind } from "~/lib/services/price";

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
          contractWorksRate: Number(
            formData.get(`band_${i}_contractWorksRate`),
          ),
          contractWorksMinPremium: Number(
            formData.get(`band_${i}_contractWorksMinPremium`),
          ),
          liability10mRate: Number(formData.get(`band_${i}_liability10mRate`)),
          liability10mMinPremium: Number(
            formData.get(`band_${i}_liability10mMinPremium`),
          ),
          liability20mRate: Number(formData.get(`band_${i}_liability20mRate`)),
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
          rate: Number(formData.get(`rate_${i}_rate`)),
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
          constructionRate: Number(formData.get(`rate_${i}_constructionRate`)),
          plantRate: Number(formData.get(`rate_${i}_plantRate`)),
        });
      }
      return { dateStart, published, rates };
    }
    case "plant":
      return {
        dateStart,
        published,
        rate: Number(formData.get("rate")),
        plantMinValue: Number(formData.get("plantMinValue")),
        plantMaxValue: Number(formData.get("plantMaxValue")),
      };
    case "terror": {
      const tierCount = Number(formData.get("tierCount") ?? 0);
      const tiers = [];
      for (let i = 0; i < tierCount; i++) {
        tiers.push({
          tier: String(formData.get(`tier_${i}_tier`) ?? ""),
          rate: Number(formData.get(`tier_${i}_rate`)),
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
