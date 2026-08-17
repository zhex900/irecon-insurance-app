import type { PremiumBreakdown } from "~/lib/db/types";
import { combinedTrueBasePremium } from "~/lib/pricing/premium-totals";

export type PremiumRowSpec = {
  label: string;
  s1Key?: keyof PremiumBreakdown;
  s2Key?: keyof PremiumBreakdown;
  combined?: "trueBase" | "esl" | "gst" | "stampDuty" | "total";
  editable?: boolean;
  strong?: boolean;
};

export const PREMIUM_BREAKDOWN_ROWS: PremiumRowSpec[] = [
  {
    label: "Base Premium",
    s1Key: "contractWorksCalculatedBasePremium",
    s2Key: "liabilityCalculatedBasePremium",
  },
  {
    label: "True Base Premium",
    s1Key: "contractWorksBasePremium",
    s2Key: "liabilityBasePremium",
    combined: "trueBase",
    editable: true,
  },
  {
    label: "Terrorism Levy",
    s1Key: "contractWorksTerrorismPremium",
    editable: true,
  },
  {
    label: "Display Homes",
    s1Key: "contractWorksDisplayHomesPremium",
    editable: true,
  },
  {
    label: "Existing Structure",
    s1Key: "contractWorksExistingStructurePremium",
    editable: true,
  },
  {
    label: "Plant and Equipment",
    s1Key: "contractWorksPlantPremium",
    editable: true,
  },
  {
    label: "Terrorism Levy Plant and Equipment",
    s1Key: "contractWorksPlantTerrorismPremium",
    editable: true,
  },
  {
    label: "ESL Plant and Equipment",
    s1Key: "contractWorksPlantESL",
    editable: true,
  },
  {
    label: "ESL",
    s1Key: "contractWorksESL",
    s2Key: "liabilityESL",
    combined: "esl",
    editable: true,
  },
  {
    label: "GST",
    s1Key: "contractWorksGST",
    s2Key: "liabilityGST",
    combined: "gst",
  },
  {
    label: "Stamp Duty",
    s1Key: "contractWorksStampDuty",
    s2Key: "liabilityStampDuty",
    combined: "stampDuty",
    editable: true,
  },
  {
    label: "Total Premium",
    combined: "total",
    strong: true,
  },
];

export function resolvePremiumRowValues(
  spec: PremiumRowSpec,
  premium: PremiumBreakdown,
  totals: PremiumBreakdown,
) {
  const s1 = spec.s1Key
    ? Number(premium[spec.s1Key])
    : spec.combined === "total"
      ? totals.contractWorksTotalPremium
      : undefined;
  const s2 = spec.s2Key
    ? Number(premium[spec.s2Key])
    : spec.combined === "total"
      ? totals.liabilityTotalPremium
      : undefined;
  return { s1, s2, combined: resolveCombined(spec, premium, totals) };
}

function resolveCombined(
  spec: PremiumRowSpec,
  premium: PremiumBreakdown,
  totals: PremiumBreakdown,
): number | undefined {
  if (spec.combined === "trueBase") return combinedTrueBasePremium(premium);
  if (spec.combined === "esl") {
    return (
      premium.contractWorksESL +
      premium.liabilityESL +
      premium.contractWorksPlantESL
    );
  }
  if (spec.combined === "gst") {
    return premium.contractWorksGST + premium.liabilityGST;
  }
  if (spec.combined === "stampDuty") {
    return premium.contractWorksStampDuty + premium.liabilityStampDuty;
  }
  if (spec.combined === "total") return totals.originalTotalPremium;
  return undefined;
}
