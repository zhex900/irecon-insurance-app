import type { ReferenceData } from "~/lib/db/types";

/** Static lookup catalogue (not customer data). ARs / excesses come from DB via getReferenceDataAsync. */
export const referenceData = {
  states: [
    { stateId: 1, code: "ACT", name: "Australian Capital Territory" },
    { stateId: 2, code: "NSW", name: "New South Wales" },
    { stateId: 3, code: "NT", name: "Northern Territory" },
    { stateId: 4, code: "QLD", name: "Queensland" },
    { stateId: 5, code: "SA", name: "South Australia" },
    { stateId: 6, code: "TAS", name: "Tasmania" },
    { stateId: 7, code: "VIC", name: "Victoria" },
    { stateId: 8, code: "WA", name: "Western Australia" },
  ],
  coverTypes: [
    { coverTypeId: 1, name: "Annual" },
    { coverTypeId: 2, name: "Single" },
    { coverTypeId: 3, name: "Owner Builder" },
  ],
  annualCoverTypes: [
    { annualCoverTypeId: 1, code: "Transfer", name: "Transfer" },
    {
      annualCoverTypeId: 2,
      code: "ContractCommencing",
      name: "Contract Commencing",
    },
  ],
  policyCategories: [
    { policyCategoryId: 1, code: "NEW", name: "New" },
    { policyCategoryId: 2, code: "RWL", name: "Renewal" },
  ],
  policyStatuses: [
    { policyStatusId: 1, name: "Pending" },
    { policyStatusId: 2, name: "Taken" },
    { policyStatusId: 3, name: "Not taken" },
  ],
  liabilityLimitBands: [
    { id: 1, name: "$10 Million" },
    { id: 2, name: "$20 Million" },
    { id: 3, name: "Not Insured" },
  ],
  insurers: [{ code: "ATC", name: "ATC" }],
  accountManagers: [
    { accountManagerId: 1, fullName: "Alex Morgan", abbrev: "AM1" },
    { accountManagerId: 2, fullName: "Jordan Lee", abbrev: "JL2" },
    { accountManagerId: 3, fullName: "Sam Patel", abbrev: "SP3" },
    { accountManagerId: 4, fullName: "Casey Nguyen", abbrev: "CN4" },
  ],
  /** Populated from DB in getReferenceDataAsync. */
  wholesaleBrokers: [],
  feeNames: [
    {
      name: "Insurer Admin (includes GST)",
      sortOrder: 1,
      fee: 150,
      feeGst: 15,
    },
    {
      name: "IAA Admin Fee (includes GST)",
      sortOrder: 2,
      fee: 75,
      feeGst: 7.5,
    },
  ],
  defaultSubLimits: {
    annual: {
      removalOfDebris: "10% of Contract Value",
      expeditingExpenses: "10% of Contract Value",
      professionalFees: "10% of Contract Value",
      mitigationExpenses: "5% of Contract Value",
      searchAndLocateCosts: "$50,000 any one loss",
      plantHireCharges: "$25,000 any one loss",
      claimsPreparationCosts: "$25,000 any one loss",
      governmentCosts: "$25,000 any one loss",
      inflationProtection: "5% of Contract Value",
      employeesProperty: "$2,500 any one employee/any one loss",
      materialsInOffSiteStorage: "$200,000 any one loss",
      transit: "$100,000 any one loss",
    },
    ownerBuilder: {
      removalOfDebris: "10% of Contract Value",
      expeditingExpenses: "5% of Contract Value",
      professionalFees: "5% of Contract Value",
      mitigationExpenses: "Not Insured",
      searchAndLocateCosts: "Not Insured",
      plantHireCharges: "Not Insured",
      claimsPreparationCosts: "Not Insured",
      governmentCosts: "Not Insured",
      inflationProtection: "Not Insured",
      employeesProperty: "Not Insured",
      materialsInOffSiteStorage: "Not Insured",
      transit: "Not Insured",
    },
  },
  defaultExcesses: {
    excessSection1A: "2500",
    excessSection1B: "1000",
    excessSection1C: "2500",
    excessSection1D: "5000",
    excessSection1E: "1000",
    excessSection2A: "15000",
    excessSection2C: "1000",
    excessSection2D: "2500",
    excessSection2E: "2500",
    excessSection2F: "2500",
  },
  defaultTexts: {
    businessActivities:
      "Residential, commercial, industrial contractors/project, including associated civil works, office occupiers and property owners of vacant land",
    insuredContractsAnnualTransfer:
      "All contracts on hand or commenced during the Period of Insurance",
    insuredContractsAnnualContractCommencing:
      "All contracts commencing during the Period of Insurance",
    insuredContractsSingle: "Single Project Name",
    geographicalScopeAnnual:
      "Anywhere in Australia below the 26th parallel south",
    excludedContracts1:
      "Are those contracts that include any of the following activities, unless agreed to by the Underwriter via Endorsement, prior to commencement:",
    excludedContracts2:
      "- Underpinning, underground, tunnelling, bridging and dam works; or\n- Airside or rail works; or\n- Demolition exceeding 20 metres in height: or\n- Works exceeding 10 levels; or\n- Works above the 26th Parallel South; or\n- With a construction period exceeding eighteen (18) months ; or\n- With a maintenance/defects liability period exceeding twelve (12) months; or\n- Contract exceeds the Sum Insured specified against Cover Item 1 (a);",
    excludedContracts3:
      "Underground means any contract where the majority of the work, and the completed structure, will be situated below ground level.\n\nTunnelling means any contract involving the excavation of an artificial subterranean passage (e.g. for the purposes of roads and railways).",
  },
} satisfies ReferenceData;
