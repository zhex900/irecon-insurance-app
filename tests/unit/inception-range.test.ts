import { describe, expect, it } from "vitest";

import {
  rangeForExpiryPreset,
  rangeForInceptionPreset,
  resolveExpiryRange,
  resolveInceptionRange,
} from "~/lib/search/date-range-filter";

describe("rangeForInceptionPreset", () => {
  it("computes last-week relative to a fixed now", () => {
    const now = new Date("2026-08-02T15:00:00");
    expect(rangeForInceptionPreset("last-week", now)).toEqual({
      from: "2026-07-26",
      to: "2026-08-02",
    });
  });

  it("computes last-month / last-6-months / last-year", () => {
    const now = new Date("2026-08-02T15:00:00");
    expect(rangeForInceptionPreset("last-month", now)).toEqual({
      from: "2026-07-02",
      to: "2026-08-02",
    });
    expect(rangeForInceptionPreset("last-6-months", now)).toEqual({
      from: "2026-02-02",
      to: "2026-08-02",
    });
    expect(rangeForInceptionPreset("last-year", now)).toEqual({
      from: "2025-08-02",
      to: "2026-08-02",
    });
  });
});

describe("rangeForExpiryPreset", () => {
  it("computes next-week / next-month / next-6-months / next-year", () => {
    const now = new Date("2026-08-02T15:00:00");
    expect(rangeForExpiryPreset("next-week", now)).toEqual({
      from: "2026-08-02",
      to: "2026-08-09",
    });
    expect(rangeForExpiryPreset("next-month", now)).toEqual({
      from: "2026-08-02",
      to: "2026-09-02",
    });
    expect(rangeForExpiryPreset("next-6-months", now)).toEqual({
      from: "2026-08-02",
      to: "2027-02-02",
    });
    expect(rangeForExpiryPreset("next-year", now)).toEqual({
      from: "2026-08-02",
      to: "2027-08-02",
    });
  });
});

describe("resolveDateRanges", () => {
  it("prefers inception preset over explicit dates", () => {
    const resolved = resolveInceptionRange({
      preset: "last-week",
      from: "2020-01-01",
      to: "2020-01-02",
    });
    expect(resolved.preset).toBe("last-week");
    expect(resolved.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolved.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses custom expiry from/to when no preset", () => {
    expect(
      resolveExpiryRange({
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    ).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
      preset: null,
    });
  });
});
