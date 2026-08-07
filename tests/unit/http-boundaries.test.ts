import { describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "~/lib/errors";
import {
  booleanFlagSchema,
  positiveIntegerSchema,
  queryTextSchema,
  searchParamsObject,
} from "~/lib/http/route-input";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { logger } from "~/lib/observability/logger.server";

vi.mock("~/lib/observability/logger.server", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("~/lib/observability/sentry.server", () => ({
  captureServerException: vi.fn(),
}));

describe("route input schemas", () => {
  it("bounds query text and rejects malformed positive ids", () => {
    expect(queryTextSchema.parse("  broker ")).toBe("broker");
    expect(queryTextSchema.parse("x".repeat(201))).toBe("");
    expect(positiveIntegerSchema.safeParse("12").success).toBe(true);
    expect(positiveIntegerSchema.safeParse("12.5").success).toBe(false);
    expect(positiveIntegerSchema.safeParse("nope").success).toBe(false);
  });

  it("accepts only explicit boolean query flags", () => {
    expect(booleanFlagSchema.parse("1")).toBe("1");
    expect(booleanFlagSchema.parse("true")).toBe("0");
  });

  it("converts URL search parameters into a schema input", () => {
    const request = new Request("https://example.test/search?q=test&limit=8");
    expect(searchParamsObject(request)).toEqual({ q: "test", limit: "8" });
  });
});

describe("domain errors", () => {
  it("carry stable public codes and statuses", () => {
    expect(new ValidationError("Invalid")).toMatchObject({
      code: "validation",
      status: 400,
    });
    expect(new ConflictError("Conflict")).toMatchObject({
      code: "conflict",
      status: 409,
    });
  });

  it("exposes domain copy but hides and logs unexpected errors", async () => {
    const { captureServerException } =
      await import("~/lib/observability/sentry.server");

    expect(
      publicErrorMessage(new ValidationError("Check the value."), {
        fallback: "Save failed.",
        operation: "test_save",
      }),
    ).toBe("Check the value.");
    expect(captureServerException).not.toHaveBeenCalled();

    expect(
      publicErrorMessage(new Error("postgres password=secret"), {
        fallback: "Save failed.",
        operation: "test_save",
      }),
    ).toBe("Save failed.");
    expect(logger.error).toHaveBeenCalledWith(
      "Unexpected route operation failure",
      expect.objectContaining({ operation: "test_save", errorType: "Error" }),
    );
    expect(captureServerException).toHaveBeenCalled();
  });
});
