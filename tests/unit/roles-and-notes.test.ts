import { describe, expect, it } from "vitest";
import {
  formatRoleLabel,
  isAdminRole,
  isSuperAdmin,
  normalizeAppRole,
} from "~/lib/auth/roles";
import {
  buildReferralNotes,
  mergeReferralNotes,
} from "~/lib/services/price/premium.service";
import { num, requireDate } from "~/lib/services/price/helpers";

describe("roles", () => {
  it("normalises unknown roles to broker", () => {
    expect(normalizeAppRole("nope")).toBe("broker");
    expect(normalizeAppRole("super-admin")).toBe("super-admin");
  });

  it("detects admin and super-admin", () => {
    expect(isSuperAdmin({ role: "super-admin" })).toBe(true);
    expect(isAdminRole({ role: "admin" })).toBe(true);
    expect(isAdminRole({ role: "broker" })).toBe(false);
    expect(formatRoleLabel("super-admin")).toBe("Super admin");
  });
});

describe("premium note helpers", () => {
  it("buildReferralNotes returns empty when no reasons", () => {
    expect(buildReferralNotes(1, [], "broker@demo.local")).toEqual([]);
  });

  it("mergeReferralNotes skips duplicate referral text", () => {
    const first = mergeReferralNotes(
      undefined,
      9,
      ["High plant"],
      "broker@demo.local",
    );
    expect(first).toHaveLength(1);
    const second = mergeReferralNotes(
      first,
      9,
      ["High plant"],
      "broker@demo.local",
    );
    expect(second).toBeUndefined();
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
