import { describe, expect, it } from "vitest";

import { appUserCreateSchema, appUserSchema } from "~/lib/zod/app-user";
import { clientDraftSchema, clientSchema } from "~/lib/zod/client";
import { carAdjustmentInputSchema } from "~/lib/zod/policy-adjustment";
import {
  carPolicyDraftSchema,
  getPolicyRuleIssues,
} from "~/lib/zod/policy-car";

describe("clientDraftSchema", () => {
  it("accepts incomplete drafts", () => {
    const parsed = clientDraftSchema.parse({});
    expect(parsed.name).toBe("");
    expect(parsed.abn).toBe("");
  });

  it("rejects invalid ABN length", () => {
    const result = clientDraftSchema.safeParse({ abn: "12345" });
    expect(result.success).toBe(false);
  });

  it("normalises ABN spaces to 11 digits", () => {
    const parsed = clientDraftSchema.parse({ abn: "12 345 678 901" });
    expect(parsed.abn).toBe("12345678901");
  });
});

describe("clientSchema", () => {
  it("requires client fields other than ABN and phone", () => {
    const result = clientSchema.safeParse({
      name: "",
      tradingName: "",
      abn: "",
      phone: "",
      email: "",
      accountManagerId: 0,
      clientSourceId: 16,
      authorisedRepresentativeId: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(
        expect.arrayContaining([
          "name",
          "email",
          "accountManagerId",
          "authorisedRepresentativeId",
        ]),
      );
      expect(paths).not.toContain("abn");
      expect(paths).not.toContain("phone");
    }
  });

  it("accepts a client without an ABN or phone", () => {
    const result = clientSchema.safeParse({
      name: "Acme Pty Ltd",
      tradingName: "",
      abn: "",
      phone: "",
      email: "a@b.co",
      accountManagerId: 1,
      clientSourceId: 16,
      authorisedRepresentativeId: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a client without a trading name", () => {
    const result = clientSchema.safeParse({
      name: "Acme Pty Ltd",
      tradingName: "",
      abn: "51824753556",
      phone: "0412 345 678",
      email: "a@b.co",
      accountManagerId: 1,
      clientSourceId: 16,
      authorisedRepresentativeId: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a complete client", () => {
    const result = clientSchema.safeParse({
      name: "Acme Pty Ltd",
      tradingName: "Acme",
      abn: "51824753556",
      phone: "0412 345 678",
      email: "a@b.co",
      accountManagerId: 1,
      clientSourceId: 16,
      authorisedRepresentativeId: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe("appUserSchema", () => {
  it("requires password confirmation match when password set", () => {
    const result = appUserSchema.safeParse({
      fullName: "Sam Broker",
      email: "sam@example.com",
      role: "broker",
      disabled: false,
      password: "password1",
      confirmPassword: "password2",
    });
    expect(result.success).toBe(false);
  });

  it("create schema requires password", () => {
    const result = appUserCreateSchema.safeParse({
      fullName: "Sam Broker",
      email: "sam@example.com",
      role: "broker",
      disabled: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("getPolicyRuleIssues", () => {
  it("flags annual cover type when annual policy and other risk fields are empty", () => {
    const issues = getPolicyRuleIssues({
      coverTypeId: 1,
      annualCoverTypeId: null,
      policyCategoryId: 1,
      hasExistingContractWorksCover: false,
    });
    expect(issues.map((issue) => issue.path.join("."))).toContain(
      "annualCoverTypeId",
    );
  });

  it("allows N/A for a visible excess", () => {
    const issues = getPolicyRuleIssues({
      coverTypeId: 1,
      estimatedTurnover: 1_000_000,
      excesses: {
        excessPlantEquipment: "N/A",
      },
    });
    expect(issues).not.toContainEqual(
      expect.objectContaining({
        path: ["excesses", "excessPlantEquipment"],
        message: "Must be a number",
      }),
    );
  });
});

describe("carPolicyDraftSchema excesses", () => {
  const excesses = {
    excessPlantEquipment: "N/A",
    excessUpTo2MMinorPerils: "1,000",
    excessUpTo2MMajorPerils: "",
    excessOver2MMinorPerils: "",
    excessOver2MMajorPerils: "",
    excessAdditionalNotes: "",
    excessWorkerToWorker: "",
    excessUpTo2MLimit10M: "",
    excessUpTo2MLimit20M: "",
    excessOver2MLimit10M: "",
    excessOver2MLimit20M: "",
  };

  it("accepts numeric values and N/A", () => {
    expect(
      carPolicyDraftSchema.safeParse({
        clientId: "11111111-1111-4111-8111-111111111111",
        excesses,
      }).success,
    ).toBe(true);
  });

  it("rejects other alphabetic excess values", () => {
    const result = carPolicyDraftSchema.safeParse({
      clientId: "11111111-1111-4111-8111-111111111111",
      excesses: { ...excesses, excessPlantEquipment: "pending" },
    });
    expect(result.success).toBe(false);
  });
});

describe("carAdjustmentInputSchema", () => {
  it("requires positive adjustment turnover", () => {
    const result = carAdjustmentInputSchema.safeParse({
      adjustmentTurnover: 0,
      stampDutyExempt: "no",
    });
    expect(result.success).toBe(false);
  });

  it("accepts yes/no stamp duty exempt", () => {
    expect(
      carAdjustmentInputSchema.parse({
        adjustmentTurnover: 100,
        stampDutyExempt: "yes",
      }).stampDutyExempt,
    ).toBe("yes");
  });
});
