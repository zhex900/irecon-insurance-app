import type { CarWording, Policy } from "~/lib/db/types";
import {
  canonicalMergeFieldName,
  normalizeMultiVariableTextSchema,
} from "~/lib/pdf/merge-field-schemas";
import {
  collectEndorsementWordings,
  coverLabel,
  ENDORSEMENTS_TABLE_FIELD,
  endorsementsTableContent,
  excessLimitMergeFields,
  liabilityLabel,
  money,
  stateCode,
  yesNo,
} from "~/lib/pdf/merge-field-tables";
import { activeBandExcessAmounts } from "~/lib/policies/excesses";
import { combinedTrueBasePremium } from "~/lib/pricing/premium-totals";
import { formatDate } from "~/lib/utils";

export type BrokerFeeLineInput = {
  name: string;
  sortOrder?: number;
  fee: number;
  feeGst: number;
};

function normalizeBrokerFeeLineName(name: string) {
  return name
    .replace(/\s*\(includes GST\)\s*$/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Named fee fields from broker fee schedule lines (ex-GST amounts + GST total).
 * Matches legacy rating sheet: Insurer Admin / IAA Admin Fee / Total Fee GST.
 */
export function brokerFeeMergeFields(
  lines: BrokerFeeLineInput[],
): Record<string, string> {
  if (lines.length === 0) return {};
  const find = (needle: string) =>
    lines.find((line) =>
      normalizeBrokerFeeLineName(line.name).includes(needle),
    );
  const insurer = find("insurer admin");
  const iaa = find("iaa admin");
  const feeGstTotal = lines.reduce((sum, line) => sum + (line.feeGst || 0), 0);
  return {
    InsurerAdminFee: money(insurer?.fee),
    IAAAdminFee: money(iaa?.fee),
    BrokerFeeGst: money(feeGstTotal),
  };
}

const FEE_LABEL_TO_FIELD: Array<{ pattern: RegExp; field: string }> = [
  { pattern: /^Insurer Admin:?$/i, field: "InsurerAdminFee" },
  { pattern: /^IAA Admin Fee:?$/i, field: "IAAAdminFee" },
  { pattern: /^Total Fee GST:?$/i, field: "BrokerFeeGst" },
  { pattern: /^Broker Fee:?$/i, field: "BrokerFee" },
];

const FEE_VALUE_FIELDS = new Set(
  FEE_LABEL_TO_FIELD.map((entry) => entry.field),
);

/**
 * Some published rating templates swapped fee value field names vs labels
 * (e.g. BrokerFeeGst drawn next to "Insurer Admin:"). Re-bind by label Y.
 */
export function alignBrokerFeeSchemaNames(
  page: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  type Labeled = { index: number; y: number; field: string };
  type Valued = { index: number; y: number };

  const labels: Labeled[] = [];
  const values: Valued[] = [];

  page.forEach((schema, index) => {
    const name = typeof schema.name === "string" ? schema.name : "";
    const content = typeof schema.content === "string" ? schema.content : "";
    const y =
      schema.position &&
      typeof schema.position === "object" &&
      typeof (schema.position as { y?: unknown }).y === "number"
        ? (schema.position as { y: number }).y
        : null;
    if (y == null) return;

    const labelHit = FEE_LABEL_TO_FIELD.find((entry) =>
      entry.pattern.test(content.trim()),
    );
    if (labelHit && !FEE_VALUE_FIELDS.has(canonicalMergeFieldName(name))) {
      labels.push({ index, y, field: labelHit.field });
      return;
    }

    const canonical = canonicalMergeFieldName(name);
    const contentKey = /^\{([A-Za-z0-9_]+)\}$/.exec(content.trim())?.[1];
    if (
      FEE_VALUE_FIELDS.has(canonical) ||
      (contentKey != null && FEE_VALUE_FIELDS.has(contentKey))
    ) {
      values.push({ index, y });
    }
  });

  if (labels.length === 0 || values.length === 0) return page;

  const assignments = new Map<number, string>();
  const usedValues = new Set<number>();
  for (const label of labels) {
    let best: { index: number; dist: number } | null = null;
    for (const value of values) {
      if (usedValues.has(value.index)) continue;
      const dist = Math.abs(value.y - label.y);
      if (dist > 2) continue;
      if (!best || dist < best.dist) best = { index: value.index, dist };
    }
    if (!best) continue;
    usedValues.add(best.index);
    assignments.set(best.index, label.field);
  }

  if (assignments.size === 0) return page;

  const next = page.map((schema) => ({ ...schema }));
  for (const [index] of assignments) {
    const schema = next[index]!;
    schema.name = `__tmp_fee_${index}`;
    schema.content = `{__tmp_fee_${index}}`;
  }
  for (const [index, field] of assignments) {
    const schema = next[index]!;
    schema.name = field;
    schema.content = `{${field}}`;
  }
  return next;
}

export function normalizePdfmeTemplateSchemas<
  T extends { schemas: Array<Array<Record<string, unknown>>> },
>(template: T): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      alignExcessSchemaNames(
        alignBrokerFeeSchemaNames(
          page.map((schema) => normalizeMultiVariableTextSchema(schema)),
        ),
      ),
    ),
  };
}

/** Repair the legacy ROA row that was saved with the wrong excess field. */
function alignExcessSchemaNames(
  page: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const label = page.find(
    (schema) =>
      typeof schema.content === "string" &&
      schema.content.trim() === "Worker to Worker Claims",
  );
  if (!label || !label.position || typeof label.position !== "object") {
    return page;
  }

  const labelY = (label.position as { y?: unknown }).y;
  if (typeof labelY !== "number") return page;

  const valueIndex = page.findIndex((schema) => {
    const name = canonicalMergeFieldName(
      typeof schema.name === "string" ? schema.name : "",
    );
    const position = schema.position;
    const y =
      position && typeof position === "object"
        ? (position as { y?: unknown }).y
        : null;
    return (
      name === "ExcessUpTo2MLimit20M" &&
      typeof y === "number" &&
      Math.abs(y - labelY) <= 2
    );
  });
  if (valueIndex < 0) return page;

  const next = page.map((schema) => ({ ...schema }));
  const schema = next[valueIndex]!;
  schema.name = "ExcessWorkerToWorker";
  schema.content = "{ExcessWorkerToWorker}";
  return next;
}

/**
 * Map a policy snapshot to pdfme merge-field names (label-based, readable).
 * Prefer precomputed `car.endorsementWordings` (form snapshot); otherwise
 * resolve ticked IDs against `wordingCatalogue` from Postgres `car_wording`.
 */
export function policyToMergeInputs(
  policy: Policy,
  options?: {
    wordingCatalogue?: CarWording[];
    brokerFeeLines?: BrokerFeeLineInput[];
  },
): Record<string, string> {
  const car = policy.car;
  const premium = car.premium;
  const adjustment = car.adjustment;
  const sub = car.subLimits ?? ({} as NonNullable<typeof car.subLimits>);
  const excess = car.excesses ?? ({} as NonNullable<typeof car.excesses>);
  const activeExcess = activeBandExcessAmounts(excess, {
    contractWorksSumInsured: car.contractWorksSumInsured,
    liabilityLimitBand: car.liabilityLimitBand,
  });
  const original = adjustment?.breakdown.original;
  const adjusted = adjustment?.breakdown.adjustment;
  const delta = adjustment?.breakdown.delta;
  const endorsementWordings =
    car.endorsementWordings && car.endorsementWordings.length > 0
      ? car.endorsementWordings
      : collectEndorsementWordings(car, options?.wordingCatalogue ?? []);

  const inputs: Record<string, string> = {
    PolicyNumber: policy.policyNumber,
    CoverType: coverLabel(car.coverTypeId),
    CoverTypeUpper: coverLabel(car.coverTypeId).toUpperCase(),
    InsuredName: car.insuredName,
    InceptionDate: formatDate(policy.dateStart),
    ExpiryDate: formatDate(policy.dateEnd),
    EstimatedTurnover: money(car.estimatedTurnover),
    State: stateCode(policy.stateId),
    PostCode: policy.postcode,
    StampDutyExempt: yesNo(adjustment?.stampDutyExempt ?? false),
    BusinessDescription: String(car.businessActivities ?? "").replace(
      /\s*\n\s*/g,
      " ",
    ),
    InsuredContracts: car.insuredContracts,
    GeographicalScope: car.geographicalScopes,
    MaximumConstructionPeriod: String(car.maximumConstructionPeriod ?? ""),
    MaximumMaintenancePeriod: String(car.maximumMaintenancePeriod ?? ""),
    // Limits of Liability (Section 1) — sum insured amounts, not premiums.
    LiabilityContractWorks: money(car.contractWorksSumInsured),
    LiabilityDisplayHomes: money(car.displayHomes),
    LiabilityExistingStructure: money(car.existingStructure),
    LiabilityConstructionPlantEquipment: money(car.plantEquipment),
    // Legacy aliases (schedule/rating templates historically used these).
    ContractWorksLimit: money(car.contractWorksSumInsured),
    DisplayHomes: money(car.displayHomes),
    ExistingStructures: money(car.existingStructure),
    ConstructionPlantEquipment: money(car.plantEquipment),
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
    AdditionalCostOfWorking: String(sub.additionalCostOfWorking ?? ""),
    LegalLiabilityLimit: liabilityLabel(car.liabilityLimitBand),
    ExcessMinorPerils: money(activeExcess.minorPerils),
    ExcessMajorPerils: money(activeExcess.majorPerils),
    ExcessLimit10M: money(activeExcess.limit10M),
    ExcessLimit20M: money(activeExcess.limit20M),
    ...excessLimitMergeFields(car.liabilityLimitBand, activeExcess),
    ExcessPlantEquipment: money(excess.excessPlantEquipment),
    ExcessUpTo2MMinorPerils: money(excess.excessUpTo2MMinorPerils),
    ExcessUpTo2MMajorPerils: money(excess.excessUpTo2MMajorPerils),
    ExcessOver2MMinorPerils: money(excess.excessOver2MMinorPerils),
    ExcessOver2MMajorPerils: money(excess.excessOver2MMajorPerils),
    ExcessAdditionalNotes: excess.excessAdditionalNotes ?? "",
    ExcessLegalLiabilityAdditionalNotes:
      excess.excessLegalLiabilityAdditionalNotes ?? "",
    ExcessWorkerToWorker: money(excess.excessWorkerToWorker),
    ExcessUpTo2MLimit10M: money(excess.excessUpTo2MLimit10M),
    ExcessUpTo2MLimit20M: money(excess.excessUpTo2MLimit20M),
    ExcessOver2MLimit10M: money(excess.excessOver2MLimit10M),
    ExcessOver2MLimit20M: money(excess.excessOver2MLimit20M),
    // Kept numbered — multi-slot excluded-contracts block.
    ExcludedContracts1: car.excludedContracts1 ?? "",
    ExcludedContracts2: car.excludedContracts2 ?? "",
    ExcludedContracts3: car.excludedContracts3 ?? "",
    ClaimsCountLast3Years: String(car.claimsCountLast3Years ?? ""),
    AnyClaimsExceed20k: yesNo(car.anyClaimsExceed20k),
    DutyOfDisclosureConfirmation: yesNo(car.declarationConfirmed),
    // Dynamic array field — catalogue selections + custom additional wording.
    [ENDORSEMENTS_TABLE_FIELD]: endorsementsTableContent(endorsementWordings),
    // Scalars kept for older templates that still use fixed subject/content slots.
    EndorsementSubject: endorsementWordings[0]?.subject ?? "",
    EndorsementContent: endorsementWordings[0]?.content ?? "",
    EndorsementSubject2: endorsementWordings[1]?.subject ?? "",
    EndorsementContent2: endorsementWordings[1]?.content ?? "",
    Notes: (policy.notes ?? [])
      .map((note) => note.description)
      .filter(Boolean)
      .join("\n\n"),
    // Same lines as Premium Summary “Referral reasons” (newline-separated).
    ReferralReasons: (car.referralReasons ?? []).join("\n"),
    // Legacy palette/template name — same value as ReferralReasons.
    ReferralName: (car.referralReasons ?? []).join("\n"),
  };

  if (premium) {
    const esPremium =
      premium.contractWorksExistingStructurePremium ??
      car.contractWorksExistingStructurePremium ??
      0;
    const dhPremium =
      premium.contractWorksDisplayHomesPremium ??
      car.contractWorksDisplayHomesPremium ??
      0;
    const plantPremium = premium.contractWorksPlantPremium ?? 0;
    const terror = premium.contractWorksTerrorismPremium ?? 0;
    const plantTerror = premium.contractWorksPlantTerrorismPremium ?? 0;
    const plantEsl = premium.contractWorksPlantESL ?? 0;
    const s1Esl = premium.contractWorksESL ?? 0;
    const s2Esl = premium.liabilityESL ?? 0;
    const s1Sd = premium.contractWorksStampDuty ?? 0;
    const s2Sd = premium.liabilityStampDuty ?? 0;
    const s1TrueBase = premium.contractWorksBasePremium ?? 0;
    const s2TrueBase = premium.liabilityBasePremium ?? 0;

    Object.assign(inputs, {
      // Premium Breakdown — always from live premium (includes manual overrides).
      ContractWorksBasePremium: money(
        premium.contractWorksCalculatedBasePremium,
      ),
      LegalLiabilityBasePremium: money(premium.liabilityCalculatedBasePremium),
      ContractWorksTrueBasePremium: money(s1TrueBase),
      LegalLiabilityTrueBasePremium: money(s2TrueBase),
      CombinedTrueBasePremium: money(combinedTrueBasePremium(premium)),
      TerrorismLevy: money(terror),
      // Premium section lines (distinct from Liability* sum-insured fields).
      PremiumDisplayHomes: money(dhPremium),
      PremiumExistingStructure: money(esPremium),
      PremiumPlantAndEquipment: money(plantPremium),
      PremiumPlantAndEquipmentTerrorismLevy: money(plantTerror),
      PremiumPlantAndEquipmentEsl: money(plantEsl),
      // Legacy aliases.
      DisplayHomesPremium: money(dhPremium),
      ExistingStructurePremium: money(esPremium),
      PlantEquipmentPremium: money(plantPremium),
      PlantEquipmentTerrorismLevy: money(plantTerror),
      PlantEquipmentEsl: money(plantEsl),
      ContractWorksEsl: money(s1Esl),
      LegalLiabilityEsl: money(s2Esl),
      CombinedEsl: money(s1Esl + s2Esl + plantEsl),
      ContractWorksGst: money(premium.contractWorksGST),
      LegalLiabilityGst: money(premium.liabilityGST),
      CombinedGst: money(
        (premium.contractWorksGST ?? 0) + (premium.liabilityGST ?? 0),
      ),
      ContractWorksStampDuty: money(s1Sd),
      LegalLiabilityStampDuty: money(s2Sd),
      CombinedStampDuty: money(s1Sd + s2Sd),
      ContractWorksTotalPremium: money(premium.contractWorksTotalPremium),
      LegalLiabilityTotalPremium: money(premium.liabilityTotalPremium),
      CombinedTotalPremium: money(premium.originalTotalPremium),
      BrokerFee: money(premium.combinedBrokerFee),
      ...brokerFeeMergeFields(options?.brokerFeeLines ?? []),
    });
  }

  if (adjustment && original && adjusted && delta) {
    Object.assign(inputs, {
      AdjustedTurnover: money(adjustment.adjustedTurnover),
      StampDutyExempt: yesNo(adjustment.stampDutyExempt),
      // Calc* = adjust "original" column (CARAdjust reconstruct), not bind premium.
      CalcTerrorismLevy: money(original.section1.terrorismPremium),
      CalcContractWorksEsl: money(original.section1.esl),
      CalcContractWorksGst: money(original.section1.gst),
      CalcContractWorksStampDuty: money(original.section1.sd),
      CalcContractWorksGross: money(original.section1.totalPremium),
      CalcLegalLiabilityEsl: money(original.section2.esl),
      CalcLegalLiabilityGst: money(original.section2.gst),
      CalcLegalLiabilityStampDuty: money(original.section2.sd),
      CalcLegalLiabilityGross: money(original.section2.totalPremium),
      CalcCombinedBaseNoTerror: money(original.total.trueBasePremium),
      CalcCombinedGst: money(original.total.gst),
      CalcCombinedStampDuty: money(original.total.sd),
      CalcCombinedGross: money(original.total.totalPremium),
      AdjustedContractWorksTrueBasePremium: money(
        adjusted.section1.trueBasePremium,
      ),
      AdjustedTerrorismLevy: money(adjusted.section1.terrorismPremium),
      AdjustedContractWorksEsl: money(adjusted.section1.esl),
      AdjustedContractWorksGst: money(adjusted.section1.gst),
      AdjustedContractWorksStampDuty: money(adjusted.section1.sd),
      AdjustedContractWorksGross: money(adjusted.section1.totalPremium),
      AdjustedLegalLiabilityTrueBasePremium: money(
        adjusted.section2.trueBasePremium,
      ),
      AdjustedLegalLiabilityEsl: money(adjusted.section2.esl),
      AdjustedLegalLiabilityGst: money(adjusted.section2.gst),
      AdjustedLegalLiabilityStampDuty: money(adjusted.section2.sd),
      AdjustedLegalLiabilityGross: money(adjusted.section2.totalPremium),
      AdjustedCombinedBaseNoTerror: money(adjusted.total.trueBasePremium),
      AdjustedCombinedGst: money(adjusted.total.gst),
      AdjustedCombinedStampDuty: money(adjusted.total.sd),
      AdjustedCombinedGross: money(adjusted.total.totalPremium),
      DeltaContractWorksTrueBasePremium: money(delta.section1.trueBasePremium),
      DeltaTerrorismLevy: money(delta.section1.terrorismPremium),
      DeltaContractWorksEsl: money(delta.section1.esl),
      DeltaContractWorksGst: money(delta.section1.gst),
      DeltaContractWorksStampDuty: money(delta.section1.sd),
      DeltaContractWorksGross: money(delta.section1.totalPremium),
      DeltaLegalLiabilityTrueBasePremium: money(delta.section2.trueBasePremium),
      DeltaLegalLiabilityEsl: money(delta.section2.esl),
      DeltaLegalLiabilityGst: money(delta.section2.gst),
      DeltaLegalLiabilityStampDuty: money(delta.section2.sd),
      DeltaLegalLiabilityGross: money(delta.section2.totalPremium),
      DeltaTrueBase: money(delta.total.trueBasePremium),
      DeltaCombinedGst: money(delta.total.gst),
      DeltaCombinedStampDuty: money(delta.total.sd),
      DeltaCombinedGross: money(delta.total.totalPremium),
    });
  }

  return inputs;
}
