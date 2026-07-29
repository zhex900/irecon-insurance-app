import type { Template } from "@pdfme/common";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";

/** Realistic fake values for template Designer preview. */
const SAMPLE_BY_FIELD: Record<string, string> = {
  PolicyNumber: "CAR-2026-004821",
  CoverType: "Annual",
  COVERTYPE: "ANNUAL",
  InsuredName: "Acme Construction Pty Ltd",
  InceptionDate: "01/07/2026",
  ExpiryDate: "30/06/2027",
  EstimatedTurnover: "$12,500,000.00",
  AdjustedTurnover: "$13,250,000.00",
  State: "NSW",
  Postcode: "2000",
  PostCode: "2000",
  StampDutyExempt: "No",
  BusinessDescriptionText:
    "Commercial and residential building construction, including fit-out and renovation works.",
  InsuredContracts:
    "All contracts commencing during the period of insurance for construction works in Australia.",
  GeographicalScope: "Anywhere in Australia",
  MaximumConstructionPeriod: "36",
  MaximumMaintenancePeriod: "12",
  SiteAddress: "100 George Street, Sydney NSW 2000",
  ExcessAdditionalNotes: "As per schedule.",
  ExcludedContracts1:
    "Contracts involving tunnelling, underground mining, or works outside Australia.",
  ExcludedContracts2: "",
  ExcludedContracts3: "",
  Subject: "Endorsement — sample wording",
  Content:
    "It is hereby noted and agreed that this policy is endorsed as follows for sample preview purposes.",
  Confirmation: "Confirmed",
  Name: "Jordan Lee",
  Tab: "",
  AnyClaimsExceed20k: "No",
  NumberOfClaimLast3Years: "0",
  DisplayHomes: "No",
  BrokerFee: "$1,250.00",
  BrokerFeeGst: "$125.00",
  OriginalTotalPremium: "$48,920.50",
  Section1Value: "$5,000,000.00",
  Section2Value: "$20,000,000.00",
  Section1TrueBasePremium: "$18,400.00",
  Section2TrueBasePremium: "$9,200.00",
  Section1TerrorismPremium: "$920.00",
  Section1GST: "$1,932.00",
  Section2GST: "$920.00",
  Section1SD: "$1,680.00",
  Section2SD: "$840.00",
  Section1ESL: "$0.00",
  Section2ESL: "$0.00",
  Section1TotalPremium: "$24,932.00",
  Section2TotalPremium: "$10,960.00",
  CombinedTrueBasePremium: "$27,600.00",
  CombinedGST: "$2,852.00",
  CombinedSD: "$2,520.00",
  CombinedESL: "$0.00",
  TotalCombinedGross: "$48,920.50",
  TotalCombinedGST: "$2,852.00",
  TotalCombinedSD: "$2,520.00",
  TotalTrueBase: "$27,600.00",
  CalcCombinedGross: "$48,920.50",
  CalcCombinedGST: "$2,852.00",
  CalcCombinedSD: "$2,520.00",
  CalcCombinedBaseNoTerror: "$27,600.00",
  CalcSection1Gross: "$24,932.00",
  CalcSection1GST: "$1,932.00",
  CalcSection1SD: "$1,680.00",
  CalcSection1ESL: "$0.00",
  CalcSection1Terrorism: "$920.00",
  CalcSection2Gross: "$10,960.00",
  CalcSection2GST: "$920.00",
  CalcSection2SD: "$840.00",
  CalcSection2ESL: "$0.00",
  ExcessSection1A: "$5,000",
  ExcessSection1B: "$5,000",
  ExcessSection1C: "$5,000",
  ExcessSection1D: "$5,000",
  ExcessSection1E: "$5,000",
  ExcessSection2A: "$5,000",
  ExcessSection2C: "$5,000",
  ExcessSection2D: "$5,000",
  ExcessSection2E: "$5,000",
  ExcessSection2F: "$5,000",
  ClaimsPreparationCosts: "$50,000",
  ProfessionalFees: "$50,000",
  RemovalOfDebris: "$500,000",
  ExpeditingExpenses: "$50,000",
  InflationProtection: "15%",
  ExistingStructures: "$0",
  EmployeesProperty: "$10,000",
  MaterialsInOffSiteStorage: "$100,000",
  MaterialsInOffSiteStorag: "$100,000",
  MitigationExpenses: "$50,000",
  SearchAndLocateCosts: "$50,000",
  PlantEquipment: "$250,000",
  PlantHireCharges: "$50,000",
  Transit: "$100,000",
  GovernmentCosts: "$25,000",
  Section1ExistingStructure: "$0.00",
  Section1PlantEquipment: "$1,200.00",
  Section1PlantESL: "$0.00",
  Section1PlantTerrorismPremium: "$60.00",
  Section1BeforeBasePremium: "$18,400.00",
  Section2BeforeBasePremium: "$9,200.00",
  TotalSection1Gross: "$24,932.00",
  TotalSection1GST: "$1,932.00",
  TotalSection1SD: "$1,680.00",
  TotalSection1ESL: "$0.00",
  TotalSection1TrueBasePremium: "$18,400.00",
  TotalSection1TerrorismPremium: "$920.00",
  TotalSection2Gross: "$10,960.00",
  TotalSection2GST: "$920.00",
  TotalSection2SD: "$840.00",
  TotalSection2ESL: "$0.00",
  TotalSection2TrueBasePremium: "$9,200.00",
  AdjustedCombinedGross: "$2,140.00",
  AdjustedCombinedGST: "$180.00",
  AdjustedCombinedSD: "$160.00",
  AdjustedCombinedBaseNoTerror: "$1,800.00",
  AdjustedSection1Gross: "$1,420.00",
  AdjustedSection1GST: "$120.00",
  AdjustedSection1SD: "$100.00",
  AdjustedSection1ESL: "$0.00",
  AdjustedSection1TrueBasePremium: "$1,200.00",
  AdjustedSection1TerrorismPremium: "$60.00",
  AdjustedSection2Gross: "$720.00",
  AdjustedSection2GST: "$60.00",
  AdjustedSection2SD: "$60.00",
  AdjustedSection2ESL: "$0.00",
  AdjustedSection2TrueBasePremium: "$600.00",
};

function sampleForField(name: string): string {
  const base = name.replace(/__\d+$/, "");
  if (base in SAMPLE_BY_FIELD) return SAMPLE_BY_FIELD[base]!;
  if (
    /premium|gst|sd|esl|fee|gross|base|terror|turnover|value|cost/i.test(base)
  ) {
    return "$1,234.00";
  }
  if (/date/i.test(base)) return "01/07/2026";
  if (/yes|exempt|claim|homes/i.test(base)) return "No";
  if (/period|number|count/i.test(base)) return "12";
  if (/address|scope|contract|description|content|note|subject/i.test(base)) {
    return `Sample ${base}`;
  }
  return `Sample ${base}`;
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

      if (
        (name.startsWith("_Label_") || name.startsWith("_Static_")) &&
        typeof schema.content === "string"
      ) {
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

  return inputs;
}
