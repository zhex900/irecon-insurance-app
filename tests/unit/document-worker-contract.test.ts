import { describe, expect, it } from "vitest";
import {
  PDF_RENDER_CONTRACT_VERSION,
  pdfRenderErrorSchema,
  pdfRenderRequestSchema,
} from "~/lib/pdf/document-worker-contract";

describe("document Worker contract", () => {
  it("accepts the bounded outer render shape", () => {
    const result = pdfRenderRequestSchema.safeParse({
      contractVersion: PDF_RENDER_CONTRACT_VERSION,
      requestId: "request-123",
      templateKey: "certificate",
      policy: {
        policyId: 42,
        policyNumber: "CAR-42",
        car: {},
      },
      template: {
        key: "certificate",
        mergeFields: [],
        template: {},
      },
      wordingCatalogue: [],
      brokerFeeLines: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown versions and malformed domain snapshots", () => {
    expect(
      pdfRenderRequestSchema.safeParse({
        contractVersion: 2,
        requestId: "request-123",
        templateKey: "certificate",
        policy: {},
        template: {},
      }).success,
    ).toBe(false);
  });

  it("only accepts public service error codes", () => {
    expect(
      pdfRenderErrorSchema.safeParse({ error: "render_failed" }).success,
    ).toBe(true);
    expect(
      pdfRenderErrorSchema.safeParse({ error: "stack_trace" }).success,
    ).toBe(false);
  });
});
