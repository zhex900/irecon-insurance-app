import { describe, expect, it } from "vitest";
import {
  formatRoleLabel,
  isAdminRole,
  isSuperAdmin,
  normalizeAppRole,
} from "~/lib/auth/roles";
import type { PolicyNote } from "~/lib/db/types";
import {
  buildReferralNotes,
  mergeReferralNotes,
  sortPolicyNotesDescending,
} from "~/lib/policies/policy-notes";
import { num, requireDate } from "~/lib/services/price/helpers";

describe("roles", () => {
  it("normalises unknown roles to broker", () => {
    expect(normalizeAppRole("nope")).toBe("broker");
    expect(normalizeAppRole("super-admin")).toBe("super-admin");
  });

  it("detects admin and super-admin", () => {
    expect(isSuperAdmin({ role: "super-admin" })).toBe(true);
    expect(isSuperAdmin({ role: "admin" })).toBe(false);
    expect(isSuperAdmin({ role: "broker" })).toBe(false);
    expect(isAdminRole({ role: "super-admin" })).toBe(true);
    expect(isAdminRole({ role: "admin" })).toBe(true);
    expect(isAdminRole({ role: "broker" })).toBe(false);
    expect(formatRoleLabel("super-admin")).toBe("System admin");
    expect(formatRoleLabel("admin")).toBe("Admin");
    expect(formatRoleLabel("broker")).toBe("Broker");
  });
});

describe("premium note helpers", () => {
  it("buildReferralNotes returns empty when no reasons", () => {
    expect(buildReferralNotes("p1", [], "broker@demo.local")).toEqual([]);
  });

  it("mergeReferralNotes skips duplicate referral text", () => {
    const first = mergeReferralNotes(
      undefined,
      "p9",
      ["High plant"],
      "broker@demo.local",
    );
    expect(first).toHaveLength(1);
    const second = mergeReferralNotes(
      first,
      "p9",
      ["High plant"],
      "broker@demo.local",
    );
    expect(second).toBeUndefined();
  });

  it("sortPolicyNotesDescending puts newest first", () => {
    const sorted = sortPolicyNotesDescending([
      {
        policyNoteId: 1,
        policyId: "p1",
        policyNoteTypeId: 1,
        description: "older",
        createdWhen: "2026-01-01T10:00:00.000Z",
        createdBy: "a@demo.local",
      },
      {
        policyNoteId: 2,
        policyId: "p1",
        policyNoteTypeId: 3,
        description: "newer",
        createdWhen: "2026-06-01T10:00:00.000Z",
        createdBy: "a@demo.local",
      },
    ]);
    expect(sorted.map((n: PolicyNote) => n.description)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("price helpers", () => {
  it("num coerces strings", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num(null)).toBe(0);
  });

  it("requireDate validates YYYY-MM-DD", () => {
    expect(requireDate("2026-07-01")).toBe("2026-07-01");
    expect(() => requireDate("01/07/2026")).toThrow(/YYYY-MM-DD/);
  });
});
