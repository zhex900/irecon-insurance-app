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
      "{Section1BeforeBasePremium}",
      "{Section2BeforeBasePremium}",
      "",
    ],
    ["Existing Structure:", "{Section1ExistingStructure}", "", ""],
    [
      "True Base Premium:",
      "{Section1TrueBasePremium}",
      "{Section2TrueBasePremium}",
      "{CombinedTrueBasePremium}",
    ],
    ["Terrorism Levy:", "{Section1TerrorismPremium}", "", ""],
    ["Plant & Equipment Base Premium", "{Section1PlantEquipment}", "", ""],
    [
      "Terrorism Levy: (Plant & Equipment)",
      "{Section1PlantTerrorismPremium}",
      "",
      "",
    ],
    ["ESL Plant & Equipment:", "{Section1PlantESL}", "", ""],
    ["ESL:", "{Section1ESL}", "{Section2ESL}", "{CombinedESL}"],
    ["GST:", "{Section1GST}", "{Section2GST}", "{CombinedGST}"],
    ["SD:", "{Section1SD}", "{Section2SD}", "{CombinedSD}"],
    ["Broker Fee:", "", "", "{BrokerFee}"],
    ["Total Fee GST:", "", "", "{BrokerFeeGst}"],
    ["Insurer Admin:", "", "", "{InsurerAdminFee}"],
    ["IAA Admin Fee:", "", "", "{IAAAdminFee}"],
    [
      "Total Premium:",
      "{Section1TotalPremium}",
      "{Section2TotalPremium}",
      "{OriginalTotalPremium}",
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
