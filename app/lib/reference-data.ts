import type { ReferenceData } from "~/lib/db/types";
import { buildExcludedContracts2Activities } from "~/lib/policies/excluded-contracts";

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
  /** Filled from DB in getReferenceDataAsync. */
  accountManagers: [],
  /** Filled from DB in getReferenceDataAsync. */
  wholesaleBrokers: [],
  /** Filled from broker_fee_schedule in getReferenceDataAsync. */
  feeNames: [],
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
      transit: "$200,000 any one loss",
      additionalCostOfWorking: "Not Insured",
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
      additionalCostOfWorking: "Not Insured",
    },
  },
  defaultExcesses: {
    excessPlantEquipment: "2500",
    excessUpTo2MMinorPerils: "1000",
    excessOver2MMinorPerils: "2500",
    excessOver2MMajorPerils: "5000",
    excessUpTo2MMajorPerils: "1000",
    excessWorkerToWorker: "15000",
    excessUpTo2MLimit10M: "1000",
    excessUpTo2MLimit20M: "2500",
    excessOver2MLimit10M: "2500",
    excessOver2MLimit20M: "2500",
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
    excludedContracts2: buildExcludedContracts2Activities(18, 12),
    excludedContracts3:
      "Underground means any contract where the majority of the work, and the completed structure, will be situated below ground level.\n\nTunnelling means any contract involving the excavation of an artificial subterranean passage (e.g. for the purposes of roads and railways).",
  },
} satisfies ReferenceData;
