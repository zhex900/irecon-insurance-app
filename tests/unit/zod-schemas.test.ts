import { describe, expect, it } from "vitest";
import { clientDraftSchema, clientSchema } from "~/lib/zod/client";
import { appUserCreateSchema, appUserSchema } from "~/lib/zod/app-user";
import { carAdjustmentInputSchema } from "~/lib/zod/policy-adjustment";

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
  it("requires name, trading name, account manager, and AR", () => {
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
          "tradingName",
          "accountManagerId",
          "authorisedRepresentativeId",
        ]),
      );
    }
  });

  it("accepts a complete client", () => {
    const result = clientSchema.safeParse({
      name: "Acme Pty Ltd",
      tradingName: "Acme",
      abn: "51824753556",
      phone: "",
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
