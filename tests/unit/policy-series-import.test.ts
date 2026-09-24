import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "~/lib/db/client";

import { attachPolicySeriesFields } from "../../scripts/db/lib/policy-series-import.mts";

vi.mock("~/lib/db/client", () => ({
  getDb: vi.fn(),
}));

describe("attachPolicySeriesFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one series row and assigns renewals sharing a normalized base", async () => {
    const insertReturning = vi.fn().mockResolvedValue([
      {
        policySeriesId: "series-a",
        seriesNumber: "ATCCWI0487",
      },
    ]);
    const insertValues = vi
      .fn()
      .mockReturnValue({ returning: insertReturning });
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    const selectLimit = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    vi.mocked(getDb).mockReturnValue({
      select,
      insert,
    } as never);

    const result = await attachPolicySeriesFields([
      {
        clientId: "client-1",
        policyNumber: "ATCCWI0487-2024",
        createdBy: "migrate:mssql",
        createdWhen: "2024-01-01T00:00:00.000Z",
      },
      {
        clientId: "client-1",
        policyNumber: "ATCCWI0487-2025",
        createdBy: "migrate:mssql",
        createdWhen: "2025-01-01T00:00:00.000Z",
      },
    ]);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0]?.policySeriesId).toBe("series-a");
    expect(result[1]?.policySeriesId).toBe("series-a");
    expect(result[0]?.seriesNumber).toBe("ATCCWI0487");
  });
});
