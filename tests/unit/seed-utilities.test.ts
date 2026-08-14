import { describe, expect, it } from "vitest";
import {
  seedClients,
  seedPolicies,
  seedUtilities,
} from "../../e2e/helpers/seed";

describe("Seed Utilities", () => {
  describe("Seed data validation", () => {
    it("has correct number of seed clients", () => {
      expect(seedClients).toHaveLength(3);
    });

    it("has correct number of seed policies", () => {
      expect(seedPolicies).toHaveLength(3);
    });

    it("seed clients have required properties", () => {
      seedClients.forEach((client) => {
        expect(client).toHaveProperty("id");
        expect(client).toHaveProperty("name");
        expect(client).toHaveProperty("abn");
        expect(client).toHaveProperty("contactEmail");
        expect(client).toHaveProperty("contactPhone");
        expect(client).toHaveProperty("address");
        expect(client).toHaveProperty("postcode");
        expect(client).toHaveProperty("stateId");
      });
    });

    it("seed policies have required properties", () => {
      seedPolicies.forEach((policy) => {
        expect(policy).toHaveProperty("id");
        expect(policy).toHaveProperty("policyNumber");
        expect(policy).toHaveProperty("clientId");
        expect(policy).toHaveProperty("policyStatusId");
        expect(policy).toHaveProperty("policyCategoryId");
        expect(policy).toHaveProperty("dateEffective");
        expect(policy).toHaveProperty("dateStart");
        expect(policy).toHaveProperty("dateEnd");
        expect(policy).toHaveProperty("postcode");
        expect(policy).toHaveProperty("stateId");
        expect(policy).toHaveProperty("isDraft");
      });
    });

    it("policies reference valid client IDs", () => {
      const clientIds = new Set(seedClients.map((c) => c.id));

      seedPolicies.forEach((policy) => {
        expect(clientIds.has(policy.clientId)).toBe(true);
      });
    });

    it("has one policy for each status", () => {
      const pendingPolicies = seedPolicies.filter(
        (p) => p.policyStatusId === 1,
      );
      const takenPolicies = seedPolicies.filter((p) => p.policyStatusId === 2);
      const notTakenPolicies = seedPolicies.filter(
        (p) => p.policyStatusId === 3,
      );

      expect(pendingPolicies).toHaveLength(1);
      expect(takenPolicies).toHaveLength(1);
      expect(notTakenPolicies).toHaveLength(1);
    });
  });

  describe("Seed utilities", () => {
    it("getClientById returns correct client", () => {
      const client = seedUtilities.getClientById("e2e-client-1");
      expect(client).toBeDefined();
      expect(client!.id).toBe("e2e-client-1");
      expect(client!.name).toBe("Test Construction Pty Ltd");
    });

    it("getClientById returns undefined for invalid ID", () => {
      const client = seedUtilities.getClientById("invalid-id");
      expect(client).toBeUndefined();
    });

    it("getPolicyById returns correct policy", () => {
      const policy = seedUtilities.getPolicyById("e2e-policy-pending");
      expect(policy).toBeDefined();
      expect(policy!.id).toBe("e2e-policy-pending");
      expect(policy!.policyStatusId).toBe(1);
    });

    it("getPoliciesByStatus returns correct policies", () => {
      const pendingPolicies = seedUtilities.getPoliciesByStatus(1);
      expect(pendingPolicies).toHaveLength(1);
      expect(pendingPolicies[0].policyNumber).toBe("E2E-PENDING-001");

      const takenPolicies = seedUtilities.getPoliciesByStatus(2);
      expect(takenPolicies).toHaveLength(1);
      expect(takenPolicies[0].policyNumber).toBe("E2E-TAKEN-002");

      const notTakenPolicies = seedUtilities.getPoliciesByStatus(3);
      expect(notTakenPolicies).toHaveLength(1);
      expect(notTakenPolicies[0].policyNumber).toBe("E2E-NOTTAKEN-003");
    });

    it("getPoliciesForClient returns correct policies", () => {
      const client1Policies =
        seedUtilities.getPoliciesForClient("e2e-client-1");
      expect(client1Policies).toHaveLength(1);
      expect(client1Policies[0].policyNumber).toBe("E2E-PENDING-001");

      const client2Policies =
        seedUtilities.getPoliciesForClient("e2e-client-2");
      expect(client2Policies).toHaveLength(1);
      expect(client2Policies[0].policyNumber).toBe("E2E-TAKEN-002");
    });

    it("getStatusName returns correct status names", () => {
      expect(seedUtilities.getStatusName(1)).toBe("Pending");
      expect(seedUtilities.getStatusName(2)).toBe("Taken");
      expect(seedUtilities.getStatusName(3)).toBe("Not taken");
      expect(seedUtilities.getStatusName(999)).toBe("Unknown");
    });
  });

  describe("Seed data consistency", () => {
    it("policy numbers are unique", () => {
      const policyNumbers = seedPolicies.map((p) => p.policyNumber);
      const uniquePolicyNumbers = new Set(policyNumbers);

      expect(policyNumbers).toHaveLength(uniquePolicyNumbers.size);
    });

    it("policy IDs are unique", () => {
      const policyIds = seedPolicies.map((p) => p.id);
      const uniquePolicyIds = new Set(policyIds);

      expect(policyIds).toHaveLength(uniquePolicyIds.size);
    });

    it("client IDs are unique", () => {
      const clientIds = seedClients.map((c) => c.id);
      const uniqueClientIds = new Set(clientIds);

      expect(clientIds).toHaveLength(uniqueClientIds.size);
    });

    it("policies have valid dates", () => {
      seedPolicies.forEach((policy) => {
        // Dates should be valid ISO strings
        expect(() => new Date(policy.dateEffective)).not.toThrow();
        expect(() => new Date(policy.dateStart)).not.toThrow();
        expect(() => new Date(policy.dateEnd)).not.toThrow();

        // Start date should be before or equal to end date
        const startDate = new Date(policy.dateStart);
        const endDate = new Date(policy.dateEnd);
        expect(startDate <= endDate).toBe(true);
      });
    });

    it("policy car data is complete", () => {
      seedPolicies.forEach((policy) => {
        expect(policy.car).toBeDefined();

        if (policy.car) {
          // Check required car properties
          expect(policy.car).toHaveProperty("coverTypeId");
          expect(policy.car).toHaveProperty("insuredName");
          expect(policy.car).toHaveProperty("siteAddress");
          expect(policy.car).toHaveProperty("estimatedTurnover");
          expect(policy.car).toHaveProperty("businessActivities");
          expect(policy.car).toHaveProperty("contractWorksSumInsured");

          // Check premium data
          expect(policy.car.premium).toBeDefined();
          expect(policy.car.premium).toHaveProperty(
            "contractWorksTotalPremium",
          );
          expect(policy.car.premium).toHaveProperty("liabilityTotalPremium");
          expect(policy.car.premium).toHaveProperty("originalTotalPremium");
        }
      });
    });
  });
});
