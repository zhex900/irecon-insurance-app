import type { Policy } from "~/lib/db/types";
import { preferPremiumOverride } from "~/lib/premium-override";
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
    // Only format bare / $ amounts — leave free text (e.g. "Not Insured") alone.
    const bare = trimmed.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(bare)) return trimmed;
    const parsed = Number(bare);
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

const LIABILITY_AMOUNT_BY_ID = new Map<number, number>([
  [1, 10_000_000],
  [2, 20_000_000],
]);

function liabilityLabel(bandId: number) {
  const amount = LIABILITY_AMOUNT_BY_ID.get(bandId);
  if (amount != null) return money(amount);
  return LIABILITY_BY_ID.get(bandId) ?? "";
}

/** pdfme table field used by Owner Builder ROA premium section. */
export const PREMIUM_CALCULATION_TABLE_FIELD = "PremiumCalculation";

/**
 * PREMIUM CALCULATION table body with `{MergeField}` placeholders.
 * Columns: label | Contract Works | Legal Liability | Combined.
 */
export function premiumCalculationTablePlaceholderContent(): string {
  // Labels / column wording match the Owner Builder Word ROA table.
  return JSON.stringify([
    [
      "Base Premium:",
      "{ContractWorksBasePremium}",
      "{LegalLiabilityBasePremium}",
      "",
    ],
    ["Existing Structure:", "{ExistingStructurePremium}", "", ""],
    ["Display Homes:", "{DisplayHomesPremium}", "", ""],
    [
      "True Base Premium:",
      "{ContractWorksTrueBasePremium}",
      "{LegalLiabilityTrueBasePremium}",
      "{CombinedTrueBasePremium}",
    ],
    ["Terrorism Levy:", "{TerrorismLevy}", "", ""],
    ["Plant & Equipment Base Premium", "{PlantEquipmentPremium}", "", ""],
    [
      "Terrorism Levy: (Plant & Equipment)",
      "{PlantEquipmentTerrorismLevy}",
      "",
      "",
    ],
    ["ESL Plant & Equipment:", "{PlantEquipmentEsl}", "", ""],
    ["ESL:", "{ContractWorksEsl}", "{LegalLiabilityEsl}", "{CombinedEsl}"],
    ["GST:", "{ContractWorksGst}", "{LegalLiabilityGst}", "{CombinedGst}"],
    [
      "SD:",
      "{ContractWorksStampDuty}",
      "{LegalLiabilityStampDuty}",
      "{CombinedStampDuty}",
    ],
    ["Broker Fee:", "", "", "{BrokerFee}"],
    ["Total Fee GST:", "", "", "{BrokerFeeGst}"],
    ["Insurer Admin:", "", "", "{InsurerAdminFee}"],
    ["IAA Admin Fee:", "", "", "{IAAAdminFee}"],
    [
      "Total Premium:",
      "{ContractWorksTotalPremium}",
      "{LegalLiabilityTotalPremium}",
      "{CombinedTotalPremium}",
    ],
  ]);
}

/** Replace `{MergeField}` tokens in a pdfme table JSON body. */
export function resolveTableContentPlaceholders(
  content: string,
  inputs: Record<string, string>,
): string {
  let rows: unknown;
  try {
    rows = JSON.parse(content);
  } catch {
    return content;
  }
  if (!Array.isArray(rows)) return content;

  return JSON.stringify(
    rows.map((row) => {
      if (!Array.isArray(row)) return row;
      return row.map((cell) => {
        if (typeof cell !== "string") return cell;
        return cell.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
          const name = key.trim();
          return name in inputs ? (inputs[name] ?? "") : "";
        });
      });
    }),
  );
}

function isJsonObjectString(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}

function variableNamesFromText(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const name = match[1]?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * pdfme multiVariableText requires `text`, `variables[]`, and JSON `content`.
 * Designer/hand edits sometimes leave only a template string in `content`.
 */
export function normalizeMultiVariableTextSchema<
  T extends Record<string, unknown>,
>(schema: T): T {
  if (schema.type !== "multiVariableText") return schema;

  const rawText = typeof schema.text === "string" ? schema.text : "";
  const rawContent = typeof schema.content === "string" ? schema.content : "";
  const contentIsValues = rawContent !== "" && isJsonObjectString(rawContent);

  const text =
    rawText ||
    (!contentIsValues && rawContent.includes("{") ? rawContent : "") ||
    " ";

  const fromSchema = Array.isArray(schema.variables)
    ? schema.variables.filter((v): v is string => typeof v === "string")
    : [];
  const variables =
    fromSchema.length > 0 ? fromSchema : variableNamesFromText(text);

  const values: Record<string, string> = contentIsValues
    ? (JSON.parse(rawContent) as Record<string, string>)
    : {};
  for (const name of variables) {
    if (!(name in values)) values[name] = "";
  }

  return {
    ...schema,
    text,
    variables,
    content: JSON.stringify(values),
  };
}

/** Build the JSON input string pdfme expects for a multiVariableText field. */
export function resolveMultiVariableTextInput(
  schema: Record<string, unknown>,
  inputs: Record<string, string>,
): string | null {
  if (schema.type !== "multiVariableText") return null;
  const normalized = normalizeMultiVariableTextSchema(schema);
  const variables = Array.isArray(normalized.variables)
    ? normalized.variables.filter((v): v is string => typeof v === "string")
    : [];

  const name = typeof schema.name === "string" ? schema.name : "";
  const existing = name ? inputs[name] : undefined;
  if (typeof existing === "string" && isJsonObjectString(existing)) {
    const parsed = JSON.parse(existing) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const variable of variables) {
      const fromJson = parsed[variable];
      values[variable] =
        fromJson == null ? (inputs[variable] ?? "") : String(fromJson);
    }
    return JSON.stringify(values);
  }

  const values: Record<string, string> = {};
  for (const variable of variables) {
    values[variable] = inputs[variable] ?? "";
  }
  return JSON.stringify(values);
}

/** Ensure multiVariableText schemas have the shape pdfme generate() expects. */
export function normalizePdfmeTemplateSchemas<
  T extends { schemas: Array<Array<Record<string, unknown>>> },
>(template: T): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => normalizeMultiVariableTextSchema(schema)),
    ),
  };
}

/**
 * Map a policy snapshot to pdfme merge-field names (label-based, readable).
 */
export function policyToMergeInputs(policy: Policy): Record<string, string> {
  const car = policy.car;
  const premium = car.premium;
  const adjustment = car.adjustment;
  const sub = car.subLimits ?? ({} as NonNullable<typeof car.subLimits>);
  const excess = car.excesses ?? ({} as NonNullable<typeof car.excesses>);
  const original = adjustment?.breakdown.original;
  const adjusted = adjustment?.breakdown.adjustment;
  const delta = adjustment?.breakdown.delta;

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
    ContractWorksLimit: money(car.contractWorksSumInsured),
    ExistingStructures: money(
      preferPremiumOverride(
        premium?.contractWorksExistingStructurePremium ??
          car.contractWorksExistingStructurePremium,
        car.existingStructure,
      ),
    ),
    DisplayHomes: money(
      preferPremiumOverride(
        premium?.contractWorksDisplayHomesPremium ??
          car.contractWorksDisplayHomesPremium,
        car.displayHomes,
      ),
    ),
    ConstructionPlantEquipment: money(
      preferPremiumOverride(
        premium?.contractWorksPlantPremium,
        car.plantEquipment,
      ),
    ),
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
    LegalLiabilityLimit: liabilityLabel(car.liabilityLimitBand),
    ExcessPlantEquipment: money(excess.excessPlantEquipment),
    ExcessUpTo2MMinorPerils: money(excess.excessUpTo2MMinorPerils),
    ExcessUpTo2MMajorPerils: money(excess.excessUpTo2MMajorPerils),
    ExcessOver2MMinorPerils: money(excess.excessOver2MMinorPerils),
    ExcessOver2MMajorPerils: money(excess.excessOver2MMajorPerils),
    ExcessAdditionalNotes: excess.excessAdditionalNotes ?? "",
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
    EndorsementSubject:
      car.customWordings?.[0]?.subject ?? car.customWordingSubject ?? "",
    EndorsementContent:
      car.customWordings?.[0]?.content ?? car.customWordingContent ?? "",
    EndorsementSubject2:
      car.customWordings?.[1]?.subject ?? car.customWordingSubject2 ?? "",
    EndorsementContent2:
      car.customWordings?.[1]?.content ?? car.customWordingContent2 ?? "",
    Notes: (policy.notes ?? [])
      .map((note) => note.description)
      .filter(Boolean)
      .join("\n\n"),
    ReferralName: car.insuredName,
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
      ExistingStructurePremium: money(esPremium),
      DisplayHomesPremium: money(dhPremium),
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
      BrokerFeeGst: money((premium.combinedBrokerFee ?? 0) * 0.1),
      // Adjustment "original turnover" calc columns (same as bind-time premium)
      CalcTerrorismLevy: money(terror),
      CalcContractWorksEsl: money(s1Esl),
      CalcContractWorksGst: money(premium.contractWorksGST),
      CalcContractWorksStampDuty: money(s1Sd),
      CalcContractWorksGross: money(premium.contractWorksTotalPremium),
      CalcLegalLiabilityEsl: money(s2Esl),
      CalcLegalLiabilityGst: money(premium.liabilityGST),
      CalcLegalLiabilityStampDuty: money(s2Sd),
      CalcLegalLiabilityGross: money(premium.liabilityTotalPremium),
      CalcCombinedBaseNoTerror: money(s1TrueBase + s2TrueBase),
      CalcCombinedGst: money(
        (premium.contractWorksGST ?? 0) + (premium.liabilityGST ?? 0),
      ),
      CalcCombinedStampDuty: money(s1Sd + s2Sd),
      CalcCombinedGross: money(premium.originalTotalPremium),
    });
  }

  if (adjustment && original && adjusted && delta) {
    Object.assign(inputs, {
      AdjustedTurnover: money(adjustment.adjustedTurnover),
      StampDutyExempt: yesNo(adjustment.stampDutyExempt),
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
