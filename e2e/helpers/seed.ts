/**
 * Deterministic seed fixtures for E2E testing
 *
 * Provides predictable, consistent test data for end-to-end tests.
 * These fixtures are designed to work with the demo user accounts.
 */

export interface SeedClient {
  id: string;
  name: string;
  abn: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  postcode: string;
  stateId: number;
}

export interface SeedPolicy {
  id: string;
  policyNumber: string;
  clientId: string;
  policyStatusId: number; // 1 = Pending, 2 = Taken, 3 = Not taken
  policyCategoryId: number;
  dateEffective: string;
  dateStart: string;
  dateEnd: string;
  postcode: string;
  stateId: number;
  isDraft: boolean;
  car?: SeedCarPolicy;
}

export interface SeedCarPolicy {
  coverTypeId: number;
  annualCoverTypeId: number | null;
  siteAddress: string;
  insuredName: string;
  estimatedTurnover: number;
  businessActivities: string;
  insuredContracts: string;
  geographicalScopes: string;
  plantEquipment: number;
  existingStructure: number;
  displayHomes: number;
  claimsCountLast3Years: number;
  anyClaimsExceed20k: boolean;
  declarationConfirmed: boolean;
  contractWorksSumInsured: number;
  liabilityLimitBand: number;
  hasExistingContractWorksCover: boolean;
  currentInsurer: string;
  maximumConstructionPeriod: number;
  maximumMaintenancePeriod: number;
  contractWorksExistingStructurePremium: number;
  contractWorksDisplayHomesPremium: number;
  premium: SeedPremium;
}

export interface SeedPremium {
  contractWorksCalculatedBasePremium: number;
  contractWorksBasePremium: number;
  contractWorksTerrorismPremium: number;
  contractWorksDisplayHomesPremium: number;
  contractWorksExistingStructurePremium: number;
  contractWorksPlantPremium: number;
  contractWorksPlantTerrorismPremium: number;
  contractWorksPlantESL: number;
  contractWorksESL: number;
  contractWorksGST: number;
  contractWorksStampDuty: number;
  contractWorksTotalPremium: number;
  liabilityCalculatedBasePremium: number;
  liabilityBasePremium: number;
  liabilityESL: number;
  liabilityGST: number;
  liabilityStampDuty: number;
  liabilityTotalPremium: number;
  combinedBrokerFee: number;
  originalTotalPremium: number;
}

/**
 * Deterministic test clients for E2E testing
 * These clients are associated with demo@demo.local user
 */
export const seedClients: SeedClient[] = [
  {
    id: "e2e-client-1",
    name: "Test Construction Pty Ltd",
    abn: "12345678901",
    contactEmail: "contact@testconstruction.com",
    contactPhone: "0412 345 678",
    address: "123 Test Street, Sydney NSW 2000",
    postcode: "2000",
    stateId: 1,
  },
  {
    id: "e2e-client-2",
    name: "Demo Builder Co",
    abn: "98765432109",
    contactEmail: "info@demobuilder.com",
    contactPhone: "0423 456 789",
    address: "456 Demo Road, Melbourne VIC 3000",
    postcode: "3000",
    stateId: 2,
  },
  {
    id: "e2e-client-3",
    name: "Sample Builder Pty Ltd",
    abn: "45678901234",
    contactEmail: "admin@samplebuilder.com",
    contactPhone: "0434 567 890",
    address: "789 Sample Avenue, Brisbane QLD 4000",
    postcode: "4000",
    stateId: 3,
  },
];

/**
 * Deterministic test policies for E2E testing
 * These policies span different statuses for testing transitions
 */
export const seedPolicies: SeedPolicy[] = [
  // Pending policy (can be edited)
  {
    id: "e2e-policy-pending",
    policyNumber: "E2E-PENDING-001",
    clientId: "e2e-client-1",
    policyStatusId: 1, // Pending
    policyCategoryId: 1,
    dateEffective: "2026-01-01",
    dateStart: "2026-01-01",
    dateEnd: "2026-12-31",
    postcode: "2000",
    stateId: 1,
    isDraft: false,
    car: {
      coverTypeId: 1,
      annualCoverTypeId: null,
      siteAddress: "123 Test Street, Sydney NSW 2000",
      insuredName: "Test Construction Pty Ltd",
      estimatedTurnover: 1000000,
      businessActivities: "Commercial Construction",
      insuredContracts: "New commercial buildings",
      geographicalScopes: "NSW",
      plantEquipment: 50000,
      existingStructure: 0,
      displayHomes: 0,
      claimsCountLast3Years: 0,
      anyClaimsExceed20k: false,
      declarationConfirmed: true,
      contractWorksSumInsured: 3000000,
      liabilityLimitBand: 3,
      hasExistingContractWorksCover: false,
      currentInsurer: "None",
      maximumConstructionPeriod: 12,
      maximumMaintenancePeriod: 12,
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 0,
      premium: {
        contractWorksCalculatedBasePremium: 1000,
        contractWorksBasePremium: 1000,
        contractWorksTerrorismPremium: 53,
        contractWorksDisplayHomesPremium: 0,
        contractWorksExistingStructurePremium: 0,
        contractWorksPlantPremium: 75,
        contractWorksPlantTerrorismPremium: 3.98,
        contractWorksPlantESL: 15.8,
        contractWorksESL: 210.6,
        contractWorksGST: 135.34,
        contractWorksStampDuty: 137.32,
        contractWorksTotalPremium: 1630.04,
        liabilityCalculatedBasePremium: 500,
        liabilityBasePremium: 500,
        liabilityESL: 0,
        liabilityGST: 50,
        liabilityStampDuty: 49.5,
        liabilityTotalPremium: 599.5,
        combinedBrokerFee: 100,
        originalTotalPremium: 2329.54,
      },
    },
  },
  // Taken policy (read-only, can be cloned)
  {
    id: "e2e-policy-taken",
    policyNumber: "E2E-TAKEN-002",
    clientId: "e2e-client-2",
    policyStatusId: 2, // Taken
    policyCategoryId: 1,
    dateEffective: "2025-01-01",
    dateStart: "2025-01-01",
    dateEnd: "2025-12-31",
    postcode: "3000",
    stateId: 2,
    isDraft: false,
    car: {
      coverTypeId: 1,
      annualCoverTypeId: null,
      siteAddress: "456 Demo Road, Melbourne VIC 3000",
      insuredName: "Demo Builder Co",
      estimatedTurnover: 2000000,
      businessActivities: "Residential Construction",
      insuredContracts: "New residential homes",
      geographicalScopes: "VIC",
      plantEquipment: 75000,
      existingStructure: 0,
      displayHomes: 2,
      claimsCountLast3Years: 1,
      anyClaimsExceed20k: false,
      declarationConfirmed: true,
      contractWorksSumInsured: 5000000,
      liabilityLimitBand: 2,
      hasExistingContractWorksCover: true,
      currentInsurer: "Previous Insurer",
      maximumConstructionPeriod: 18,
      maximumMaintenancePeriod: 12,
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 500,
      premium: {
        contractWorksCalculatedBasePremium: 1500,
        contractWorksBasePremium: 1500,
        contractWorksTerrorismPremium: 79.5,
        contractWorksDisplayHomesPremium: 500,
        contractWorksExistingStructurePremium: 0,
        contractWorksPlantPremium: 112.5,
        contractWorksPlantTerrorismPremium: 5.97,
        contractWorksPlantESL: 23.7,
        contractWorksESL: 315.9,
        contractWorksGST: 203.01,
        contractWorksStampDuty: 205.95,
        contractWorksTotalPremium: 2944.63,
        liabilityCalculatedBasePremium: 750,
        liabilityBasePremium: 750,
        liabilityESL: 0,
        liabilityGST: 75,
        liabilityStampDuty: 74.25,
        liabilityTotalPremium: 899.25,
        combinedBrokerFee: 150,
        originalTotalPremium: 3993.88,
      },
    },
  },
  // Not taken policy (read-only, can be cloned)
  {
    id: "e2e-policy-not-taken",
    policyNumber: "E2E-NOTTAKEN-003",
    clientId: "e2e-client-3",
    policyStatusId: 3, // Not taken
    policyCategoryId: 1,
    dateEffective: "2024-01-01",
    dateStart: "2024-01-01",
    dateEnd: "2024-12-31",
    postcode: "4000",
    stateId: 3,
    isDraft: false,
    car: {
      coverTypeId: 1,
      annualCoverTypeId: null,
      siteAddress: "789 Sample Avenue, Brisbane QLD 4000",
      insuredName: "Sample Builder Pty Ltd",
      estimatedTurnover: 500000,
      businessActivities: "Small Renovations",
      insuredContracts: "Home renovations",
      geographicalScopes: "QLD",
      plantEquipment: 25000,
      existingStructure: 0,
      displayHomes: 0,
      claimsCountLast3Years: 0,
      anyClaimsExceed20k: false,
      declarationConfirmed: true,
      contractWorksSumInsured: 1000000,
      liabilityLimitBand: 1,
      hasExistingContractWorksCover: false,
      currentInsurer: "None",
      maximumConstructionPeriod: 6,
      maximumMaintenancePeriod: 6,
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 0,
      premium: {
        contractWorksCalculatedBasePremium: 500,
        contractWorksBasePremium: 500,
        contractWorksTerrorismPremium: 26.5,
        contractWorksDisplayHomesPremium: 0,
        contractWorksExistingStructurePremium: 0,
        contractWorksPlantPremium: 37.5,
        contractWorksPlantTerrorismPremium: 1.99,
        contractWorksPlantESL: 7.9,
        contractWorksESL: 105.3,
        contractWorksGST: 67.67,
        contractWorksStampDuty: 68.66,
        contractWorksTotalPremium: 815.02,
        liabilityCalculatedBasePremium: 250,
        liabilityBasePremium: 250,
        liabilityESL: 0,
        liabilityGST: 25,
        liabilityStampDuty: 24.75,
        liabilityTotalPremium: 299.75,
        combinedBrokerFee: 50,
        originalTotalPremium: 1164.77,
      },
    },
  },
];

/**
 * Utility functions for working with seed data
 */
export const seedUtilities = {
  /**
   * Get a client by ID
   */
  getClientById(id: string): SeedClient | undefined {
    return seedClients.find((client) => client.id === id);
  },

  /**
   * Get a policy by ID
   */
  getPolicyById(id: string): SeedPolicy | undefined {
    return seedPolicies.find((policy) => policy.id === id);
  },

  /**
   * Get policies by status
   */
  getPoliciesByStatus(statusId: number): SeedPolicy[] {
    return seedPolicies.filter((policy) => policy.policyStatusId === statusId);
  },

  /**
   * Get policies for a specific client
   */
  getPoliciesForClient(clientId: string): SeedPolicy[] {
    return seedPolicies.filter((policy) => policy.clientId === clientId);
  },

  /**
   * Get policy status name from ID
   */
  getStatusName(statusId: number): string {
    const statusMap: Record<number, string> = {
      1: "Pending",
      2: "Taken",
      3: "Not taken",
    };
    return statusMap[statusId] || "Unknown";
  },
};
