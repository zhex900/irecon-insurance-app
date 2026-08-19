import { describe, expect, it, vi } from "vitest";

import { generatePdf } from "../../workers/pdf/generate-pdf";

vi.mock("../../app/lib/pdf/generate", () => ({
  generatePolicyPdf: vi.fn(),
}));

vi.mock("../../workers/pdf/fonts", () => ({
  getDocumentWorkerFonts: vi.fn(),
}));

const env = { ASSETS: { fetch: vi.fn() } } as unknown as PdfWorkerEnv;

describe("PDF worker RPC generatePdf", () => {
  it("rejects invalid payloads without echoing the request", async () => {
    const response = await generatePdf(
      {
        contractVersion: 1,
        requestId: "req-secret",
        templateKey: "certificate",
        policy: { policyNumber: "SECRET-POL" },
        template: {},
      },
      env,
    );
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("invalid_request");
    expect(body).toContain("req-secret");
    expect(body).not.toContain("SECRET-POL");
  });
});
