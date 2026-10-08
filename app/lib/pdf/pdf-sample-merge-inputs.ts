import type { Template } from "@pdfme/common";

import { isStaticSchemaName } from "~/lib/documents/template-editor-form";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";
import {
  endorsementsTableContent,
  normalizeMultiVariableTextSchema,
  resolveMultiVariableTextInput,
  resolveTableMergeInput,
} from "~/lib/pdf/merge-fields";

const SAMPLE_REFERRAL_REASONS = [
  "Display Homes has a value of $10",
  "Existing Structure has a value of $111",
  "Number of claim last 3 years is entered with value 12",
  "Any claims exceeded $20,000 in value is stated as yes",
  "Any claims exceeded $20,000 in value is stated as no",
  "Unable to find terrorism rate for this combination of postcode/State",
].join("\n");

/** Realistic fake values for template Designer preview. */
const SAMPLE_BY_FIELD: Record<string, string> = {
  PolicyNumber: "CAR-2026-004821",
  CoverType: "Annual",
  CoverTypeUpper: "ANNUAL",
  InsuredName: "Acme Construction Pty Ltd",
  InceptionDate: "01/07/2026",
  ExpiryDate: "30/06/2027",
  EstimatedTurnover: "$12,500,000",
  AdjustedTurnover: "$13,250,000",
  State: "NSW",
  PostCode: "2000",
  StampDutyExempt: "No",
  BusinessDescription:
    "Commercial and residential building construction, including fit-out and renovation works.",
  InsuredContracts:
    "All contracts commencing during the period of insurance for construction works in Australia.",
  GeographicalScope: "Anywhere in Australia",
  MaximumConstructionPeriod: "36",
  MaximumMaintenancePeriod: "12",
  SiteAddress: "100 George Street, Sydney NSW 2000",
  ExcessAdditionalNotes: "As per schedule.",
  ExcessLegalLiabilityAdditionalNotes: "As per schedule.",
  ExcludedContracts1:
    "Contracts involving tunnelling, underground mining, or works outside Australia.",
  ExcludedContracts2: "",
  ExcludedContracts3: "",
  Endorsements: endorsementsTableContent([
    {
      subject: "<p><strong>Endorsement — sample wording</strong></p>",
      content:
        "<p>It is hereby noted and agreed that this policy is <em>endorsed</em> as follows:</p><ul><li>Sample bullet one</li><li><u>Underlined</u> bullet two</li></ul>",
    },
    {
      subject: "<p><strong>Additional conditions</strong></p>",
      content:
        "<p>The insured must notify the insurer of any material change to the contract works programme.</p>",
    },
  ]),
  EndorsementSubject: "<p><strong>Endorsement — sample wording</strong></p>",
  EndorsementContent:
    "<p>It is hereby noted and agreed that this policy is <em>endorsed</em> as follows:</p><ul><li>Sample bullet one</li><li><u>Underlined</u> bullet two</li></ul>",
  customEndorsementSubject: "<p><strong>Custom additional wording</strong></p>",
  customEndorsementContent:
    "<p>Wizard custom wording body — title above, content below.</p>",
  DutyOfDisclosureConfirmation: "Confirmed",
  ReferralReasons: SAMPLE_REFERRAL_REASONS,
  // Legacy alias — same value as ReferralReasons for old templates.
  ReferralName: SAMPLE_REFERRAL_REASONS,
  AnyClaimsExceed20k: "No",
  ClaimsCountLast3Years: "0",
  LiabilityDisplayHomes: "$250,000",
  LiabilityContractWorks: "$5,000,000",
  LiabilityExistingStructure: "$0",
  LiabilityConstructionPlantEquipment: "$250,000",
  // Legacy aliases for older templates.
  DisplayHomes: "$250,000",
  BrokerFee: "$308.00",
  BrokerFeeGst: "$28.00",
  InsurerAdminFee: "$200.00",
  IAAAdminFee: "$80.00",
  CombinedTotalPremium: "$48,921.00",
  ContractWorksLimit: "$5,000,000",
  LegalLiabilityLimit: "$20,000,000",
  ContractWorksTrueBasePremium: "$18,400.00",
  LegalLiabilityTrueBasePremium: "$9,200.00",
  TerrorismLevy: "$920.00",
  ContractWorksGst: "$1,932.00",
  LegalLiabilityGst: "$920.00",
  ContractWorksStampDuty: "$1,680.00",
  LegalLiabilityStampDuty: "$840.00",
  ContractWorksEsl: "$0.00",
  LegalLiabilityEsl: "$0.00",
  ContractWorksTotalPremium: "$24,932.00",
  LegalLiabilityTotalPremium: "$10,960.00",
  CombinedTrueBasePremium: "$27,600.00",
  CombinedGst: "$2,852.00",
  CombinedStampDuty: "$2,520.00",
  CombinedEsl: "$0.00",
  CalcCombinedGross: "$48,921",
  CalcCombinedGst: "$2,852",
  CalcCombinedStampDuty: "$2,520",
  CalcCombinedBaseNoTerror: "$27,600",
  CalcContractWorksGross: "$24,932",
  CalcContractWorksGst: "$1,932",
  CalcContractWorksStampDuty: "$1,680",
  CalcContractWorksEsl: "$0",
  CalcTerrorismLevy: "$920",
  CalcLegalLiabilityGross: "$10,960",
  CalcLegalLiabilityGst: "$920",
  CalcLegalLiabilityStampDuty: "$840",
  CalcLegalLiabilityEsl: "$0",
  ExcessPlantEquipment: "$5,000",
  ExcessMinorPerils: "$5,000",
  ExcessMajorPerils: "$5,000",
  ExcessLimit10M: "$5,000",
  ExcessLimit20M: "$5,000",
  ExcessLimitLabel: "$10,000,000 Limit of Liability",
  ExcessLimit: "$5,000",
  ExcessUpTo2MMinorPerils: "$5,000",
  ExcessOver2MMinorPerils: "$5,000",
  ExcessOver2MMajorPerils: "$5,000",
  ExcessUpTo2MMajorPerils: "$5,000",
  ExcessWorkerToWorker: "$5,000",
  ExcessUpTo2MLimit10M: "$5,000",
  ExcessUpTo2MLimit20M: "$5,000",
  ExcessOver2MLimit10M: "$5,000",
  ExcessOver2MLimit20M: "$5,000",
  ClaimsPreparationCosts: "$50,000",
  ProfessionalFees: "$50,000",
  RemovalOfDebris: "$500,000",
  ExpeditingExpenses: "$50,000",
  InflationProtection: "15%",
  ExistingStructures: "$0",
  EmployeesProperty: "$10,000",
  MaterialsInOffSiteStorage: "$100,000",
  MitigationExpenses: "$50,000",
  SearchAndLocateCosts: "$50,000",
  ConstructionPlantEquipment: "$250,000",
  PlantHireCharges: "$50,000",
  Transit: "$100,000",
  AdditionalCostOfWorking: "Not Insured",
  GovernmentCosts: "$25,000",
  PremiumDisplayHomes: "$500.00",
  PremiumExistingStructure: "$0.00",
  PremiumPlantAndEquipment: "$1,200.00",
  PremiumPlantAndEquipmentEsl: "$0.00",
  PremiumPlantAndEquipmentTerrorismLevy: "$60.00",
  // Legacy aliases for older templates.
  ExistingStructurePremium: "$0.00",
  DisplayHomesPremium: "$500.00",
  PlantEquipmentPremium: "$1,200.00",
  PlantEquipmentEsl: "$0.00",
  PlantEquipmentTerrorismLevy: "$60.00",
  ContractWorksBasePremium: "$18,400.00",
  LegalLiabilityBasePremium: "$9,200.00",
  DeltaContractWorksGross: "$24,932",
  DeltaContractWorksGst: "$1,932",
  DeltaContractWorksStampDuty: "$1,680",
  DeltaContractWorksEsl: "$0",
  DeltaContractWorksTrueBasePremium: "$18,400",
  DeltaTerrorismLevy: "$920",
  DeltaLegalLiabilityGross: "$10,960",
  DeltaLegalLiabilityGst: "$920",
  DeltaLegalLiabilityStampDuty: "$840",
  DeltaLegalLiabilityEsl: "$0",
  DeltaLegalLiabilityTrueBasePremium: "$9,200",
  AdjustedCombinedGross: "$2,140",
  AdjustedCombinedGst: "$180",
  AdjustedCombinedStampDuty: "$160",
  AdjustedCombinedBaseNoTerror: "$1,800",
  AdjustedContractWorksGross: "$1,420",
  AdjustedContractWorksGst: "$120",
  AdjustedContractWorksStampDuty: "$100",
  AdjustedContractWorksEsl: "$0",
  AdjustedContractWorksTrueBasePremium: "$1,200",
  AdjustedTerrorismLevy: "$60",
  AdjustedLegalLiabilityGross: "$720",
  AdjustedLegalLiabilityGst: "$60",
  AdjustedLegalLiabilityStampDuty: "$60",
  AdjustedLegalLiabilityEsl: "$0",
  AdjustedLegalLiabilityTrueBasePremium: "$600",
};

/** Canonical merge-field names (samples + preview). */
export const KNOWN_MERGE_FIELD_NAMES = Object.keys(SAMPLE_BY_FIELD).sort(
  (a, b) => a.localeCompare(b),
);

/**
 * Designer left-palette names — prefer EndorsementSubject + EndorsementContent
 * (repeating pair). `Endorsements` merge JSON feeds expand when prototypes exist.
 * ReferralName is a legacy alias of ReferralReasons (hidden from palette).
 */
const PALETTE_EXCLUDED = new Set(["Endorsements", "ReferralName"]);

export const PALETTE_MERGE_FIELD_NAMES = KNOWN_MERGE_FIELD_NAMES.filter(
  (name) => !PALETTE_EXCLUDED.has(name),
);

function sampleForField(name: string): string {
  const base = name.replace(/__\d+$/, "");
  if (base in SAMPLE_BY_FIELD) return SAMPLE_BY_FIELD[base]!;
  if (
    /premium|gst|sd|esl|fee|gross|base|terror|turnover|value|cost/i.test(base)
  ) {
    return "$1,234";
  }
  if (/date/i.test(base)) return "01/07/2026";
  if (/yes|exempt|claim|homes/i.test(base)) return "No";
  if (/period|number|count/i.test(base)) return "12";
  if (/address|scope|contract|description|content|note|subject/i.test(base)) {
    return `Sample ${base}`;
  }
  return `Sample ${base}`;
}

function isJsonArrayString(value: string): boolean {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

/** Table / list inputs must be JSON arrays — plain sample strings break generate(). */
function sampleStructuredContent(
  type: string | undefined,
  content: unknown,
): string | null {
  if (type === "table") {
    if (typeof content === "string" && isJsonArrayString(content)) {
      return content;
    }
    return JSON.stringify([
      ["Alice", "New York", "Sample row"],
      ["Bob", "Paris", "Sample row"],
    ]);
  }
  if (type === "list") {
    if (typeof content === "string" && isJsonArrayString(content)) {
      return content;
    }
    return JSON.stringify(["Sample item 1", "Sample item 2"]);
  }
  return null;
}

/**
 * Build pdfme `inputs` for Designer preview — fake policy values + static labels.
 */
export function buildSampleMergeInputs(
  template: Template,
  mergeFields: string[],
  flowPushDown?: FlowPushDown | null,
): Record<string, string> {
  const inputs: Record<string, string> = {};

  for (const name of mergeFields) {
    inputs[name] = sampleForField(name);
  }

  for (const page of template.schemas) {
    for (const schema of page) {
      const name = schema.name;
      if (!name) continue;

      if (schema.type === "multiVariableText") {
        const normalized = normalizeMultiVariableTextSchema(
          schema as Record<string, unknown>,
        );
        const mvt = resolveMultiVariableTextInput(normalized, inputs);
        if (mvt != null) inputs[name] = mvt;
        continue;
      }

      if (schema.type === "table" && typeof schema.content === "string") {
        inputs[name] = resolveTableMergeInput(name, schema.content, inputs);
        continue;
      }

      const structured = sampleStructuredContent(schema.type, schema.content);
      if (structured != null) {
        inputs[name] = structured;
        continue;
      }

      if (isStaticSchemaName(name) && typeof schema.content === "string") {
        inputs[name] = schema.content;
        continue;
      }

      if (!(name in inputs)) {
        inputs[name] = sampleForField(name);
      }
    }
  }

  if (flowPushDown?.staticInputs) {
    Object.assign(inputs, flowPushDown.staticInputs);
  }

  // Subject+Content pair expands from the Endorsements JSON list — ensure it
  // exists for expand even though `Endorsements` is not a designer palette field.
  const hasEndorsementPair = template.schemas.some((page) =>
    page.some((schema) => {
      const base = String(schema.name ?? "").replace(/__\d+$/, "");
      return base === "EndorsementSubject" || base === "EndorsementContent";
    }),
  );
  if (hasEndorsementPair && !inputs.Endorsements) {
    inputs.Endorsements = SAMPLE_BY_FIELD.Endorsements!;
  }

  return inputs;
}
