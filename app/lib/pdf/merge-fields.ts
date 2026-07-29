import type { Policy } from "~/lib/db/types";
import { combinedTrueBasePremium } from "~/lib/premium-totals";
import { referenceData as reference } from "~/lib/reference-data";
import { formatCurrency, formatDate } from "~/lib/utils";

const STATE_BY_ID = new Map(
  reference.states.map((s) => [s.stateId, s.code] as const),
);

const COVER_BY_ID = new Map(
  reference.coverTypes.map((c) => [c.coverTypeId, c.name] as const),
);

const LIABILITY_BY_ID = new Map(
  reference.liabilityLimitBands.map((b) => [b.id, b.name] as const),
);

function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = Number(trimmed.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(parsed)) return trimmed;
    return formatCurrency(parsed);
  }
  if (Number.isNaN(value)) return "";
  return formatCurrency(value);
}

function yesNo(value: boolean | null | undefined) {
  if (value == null) return "";
  return value ? "Yes" : "No";
}

function coverLabel(coverTypeId: number) {
  return COVER_BY_ID.get(coverTypeId) ?? "Annual";
}

function stateCode(stateId: number) {
  return STATE_BY_ID.get(stateId) ?? "";
}

function liabilityLabel(bandId: number) {
  return LIABILITY_BY_ID.get(bandId) ?? "";
}

/**
 * Map a policy snapshot to legacy Word MERGEFIELD names.
 * Keys are legacy Word MERGEFIELD names used in pdfme schemas.
 */
export function policyToMergeInputs(policy: Policy): Record<string, string> {
  const car = policy.car;
  const premium = car.premium;
  const adjustment = car.adjustment;
  const sub = car.subLimits;
  const excess = car.excesses;
  const original = adjustment?.breakdown.original;
  const adjusted = adjustment?.breakdown.adjustment;
  const delta = adjustment?.breakdown.delta;

  const inputs: Record<string, string> = {
    PolicyNumber: policy.policyNumber,
    CoverType: coverLabel(car.coverTypeId),
    COVERTYPE: coverLabel(car.coverTypeId).toUpperCase(),
    InsuredName: car.insuredName,
    InceptionDate: formatDate(policy.dateStart),
    ExpiryDate: formatDate(policy.dateEnd),
    EstimatedTurnover: money(car.estimatedTurnover),
    State: stateCode(policy.stateId),
    Postcode: policy.postcode,
    PostCode: policy.postcode,
    StampDutyExempt: yesNo(adjustment?.stampDutyExempt ?? false),
    BusinessDescriptionText: String(car.businessActivities ?? "").replace(
      /\s*\n\s*/g,
      " ",
    ),
    InsuredContracts: car.insuredContracts,
    GeographicalScope: car.geographicalScopes,
    MaximumConstructionPeriod: String(car.maximumConstructionPeriod ?? ""),
    MaximumMaintenancePeriod: String(car.maximumMaintenancePeriod ?? ""),
    Section1Value: money(car.contractWorksSumInsured),
    ExistingStructures: money(car.existingStructure),
    DisplayHomes: money(car.displayHomes),
    PlantEquipment: money(car.plantEquipment),
    SiteAddress: car.siteAddress,
    RemovalOfDebris: String(sub.removalOfDebris ?? ""),
    ExpeditingExpenses: String(sub.expeditingExpenses ?? ""),
    ProfessionalFees: String(sub.professionalFees ?? ""),
    MitigationExpenses: String(sub.mitigationExpenses ?? ""),
    SearchAndLocateCosts: String(sub.searchAndLocateCosts ?? ""),
    PlantHireCharges: String(sub.plantHireCharges ?? ""),
    ClaimsPreparationCosts: String(sub.claimsPreparationCosts ?? ""),
    GovernmentCosts: String(sub.governmentCosts ?? ""),
    InflationProtection: String(sub.inflationProtection ?? ""),
    EmployeesProperty: String(sub.employeesProperty ?? ""),
    MaterialsInOffSiteStorage: String(sub.materialsInOffSiteStorage ?? ""),
    Transit: String(sub.transit ?? ""),
    Section2Value: liabilityLabel(car.liabilityLimitBand),
    ExcessSection1A: excess.excessSection1A,
    ExcessSection1B: excess.excessSection1B,
    ExcessSection1C: excess.excessSection1C,
    ExcessSection1D: excess.excessSection1D,
    ExcessSection1E: excess.excessSection1E,
    ExcessAdditionalNotes: excess.excessAdditionalNotes ?? "",
    ExcessSection2A: excess.excessSection2A,
    ExcessSection2C: excess.excessSection2C,
    ExcessSection2D: excess.excessSection2D,
    ExcessSection2E: excess.excessSection2E,
    ExcessSection2F: excess.excessSection2F,
    // One top-aligned block in the template — join the legacy 3-way split.
    ExcludedContracts1: car.excludedContracts1 ?? "",
    ExcludedContracts2: car.excludedContracts2 ?? "",
    ExcludedContracts3: car.excludedContracts3 ?? "",
    NumberOfClaimLast3Years: String(car.claimsCountLast3Years ?? ""),
    AnyClaimsExceed20k: yesNo(car.anyClaimsExceed20k),
    Confirmation: yesNo(car.declarationConfirmed),
    Subject: car.customWordings?.[0]?.subject ?? car.customWordingSubject ?? "",
    Content: car.customWordings?.[0]?.content ?? car.customWordingContent ?? "",
    Subject2:
      car.customWordings?.[1]?.subject ?? car.customWordingSubject2 ?? "",
    Content2:
      car.customWordings?.[1]?.content ?? car.customWordingContent2 ?? "",
    Notes: (policy.notes ?? [])
      .map((note) => note.description)
      .filter(Boolean)
      .join("\n\n"),
    Name: car.insuredName,
  };

  if (premium) {
    Object.assign(inputs, {
      Section1BeforeBasePremium: money(
        premium.contractWorksCalculatedBasePremium,
      ),
      Section1TrueBasePremium: money(premium.contractWorksBasePremium),
      Section1PlantEquipment: money(premium.contractWorksPlantPremium),
      Section1PlantESL: money(premium.contractWorksPlantESL),
      Section1ESL: money(premium.contractWorksESL),
      Section1GST: money(premium.contractWorksGST),
      Section1SD: money(premium.contractWorksStampDuty),
      Section1TerrorismPremium: money(premium.contractWorksTerrorismPremium),
      Section1PlantTerrorismPremium: money(
        premium.contractWorksPlantTerrorismPremium,
      ),
      Section1ExistingStructure: money(
        premium.contractWorksExistingStructurePremium,
      ),
      Section1TotalPremium: money(premium.contractWorksTotalPremium),
      Section2BeforeBasePremium: money(premium.liabilityCalculatedBasePremium),
      Section2TrueBasePremium: money(premium.liabilityBasePremium),
      Section2ESL: money(premium.liabilityESL),
      Section2GST: money(premium.liabilityGST),
      Section2SD: money(premium.liabilityStampDuty),
      Section2TotalPremium: money(premium.liabilityTotalPremium),
      CombinedTrueBasePremium: money(combinedTrueBasePremium(premium)),
      CombinedESL: money(premium.contractWorksESL + premium.liabilityESL),
      CombinedGST: money(premium.contractWorksGST + premium.liabilityGST),
      CombinedSD: money(
        premium.contractWorksStampDuty + premium.liabilityStampDuty,
      ),
      BrokerFee: money(premium.combinedBrokerFee),
      BrokerFeeGst: money(premium.combinedBrokerFee * 0.1),
      OriginalTotalPremium: money(premium.originalTotalPremium),
      // Adjustment "original turnover" calc columns (same as bind-time premium)
      CalcSection1Terrorism: money(premium.contractWorksTerrorismPremium),
      CalcSection1ESL: money(premium.contractWorksESL),
      CalcSection1GST: money(premium.contractWorksGST),
      CalcSection1SD: money(premium.contractWorksStampDuty),
      CalcSection1Gross: money(premium.contractWorksTotalPremium),
      CalcSection2ESL: money(premium.liabilityESL),
      CalcSection2GST: money(premium.liabilityGST),
      CalcSection2SD: money(premium.liabilityStampDuty),
      CalcSection2Gross: money(premium.liabilityTotalPremium),
      CalcCombinedBaseNoTerror: money(
        premium.contractWorksBasePremium + premium.liabilityBasePremium,
      ),
      CalcCombinedGST: money(premium.contractWorksGST + premium.liabilityGST),
      CalcCombinedSD: money(
        premium.contractWorksStampDuty + premium.liabilityStampDuty,
      ),
      CalcCombinedGross: money(premium.originalTotalPremium),
    });
  }

  if (adjustment && original && adjusted && delta) {
    Object.assign(inputs, {
      AdjustedTurnover: money(adjustment.adjustedTurnover),
      StampDutyExempt: yesNo(adjustment.stampDutyExempt),
      AdjustedSection1TrueBasePremium: money(adjusted.section1.trueBasePremium),
      AdjustedSection1TerrorismPremium: money(
        adjusted.section1.terrorismPremium,
      ),
      AdjustedSection1ESL: money(adjusted.section1.esl),
      AdjustedSection1GST: money(adjusted.section1.gst),
      AdjustedSection1SD: money(adjusted.section1.sd),
      AdjustedSection1Gross: money(adjusted.section1.totalPremium),
      AdjustedSection2TrueBasePremium: money(adjusted.section2.trueBasePremium),
      AdjustedSection2ESL: money(adjusted.section2.esl),
      AdjustedSection2GST: money(adjusted.section2.gst),
      AdjustedSection2SD: money(adjusted.section2.sd),
      AdjustedSection2Gross: money(adjusted.section2.totalPremium),
      AdjustedCombinedBaseNoTerror: money(adjusted.total.trueBasePremium),
      AdjustedCombinedGST: money(adjusted.total.gst),
      AdjustedCombinedSD: money(adjusted.total.sd),
      AdjustedCombinedGross: money(adjusted.total.totalPremium),
      TotalSection1TrueBasePremium: money(delta.section1.trueBasePremium),
      TotalSection1TerrorismPremium: money(delta.section1.terrorismPremium),
      TotalSection1ESL: money(delta.section1.esl),
      TotalSection1GST: money(delta.section1.gst),
      TotalSection1SD: money(delta.section1.sd),
      TotalSection1Gross: money(delta.section1.totalPremium),
      TotalSection2TrueBasePremium: money(delta.section2.trueBasePremium),
      TotalSection2ESL: money(delta.section2.esl),
      TotalSection2GST: money(delta.section2.gst),
      TotalSection2SD: money(delta.section2.sd),
      TotalSection2Gross: money(delta.section2.totalPremium),
      TotalTrueBase: money(delta.total.trueBasePremium),
      TotalCombinedGST: money(delta.total.gst),
      TotalCombinedSD: money(delta.total.sd),
      TotalCombinedGross: money(delta.total.totalPremium),
    });
  }

  return inputs;
}
