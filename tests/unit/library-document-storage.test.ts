import { describe, expect, it } from "vitest";

import {
  applyPrivatePdfResponseHeaders,
  hasPdfHeader,
} from "~/lib/storage/library-documents.server";

describe("library document PDF security", () => {
  it("accepts a PDF header within the first 1024 bytes", () => {
    expect(hasPdfHeader(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(hasPdfHeader(new TextEncoder().encode("\n%PDF-1.4\n"))).toBe(true);
    expect(hasPdfHeader(new TextEncoder().encode("not a pdf"))).toBe(false);
  });

  it("sets private, sandboxed PDF response headers", () => {
    const headers = new Headers();
    applyPrivatePdfResponseHeaders(headers, 'unsafe"\r\nname.pdf');

    expect(headers.get("content-type")).toBe("application/pdf");
    expect(headers.get("cache-control")).toBe("private, max-age=3600");
    expect(headers.get("content-disposition")).toBe(
      'inline; filename="unsafename.pdf"',
    );
    expect(headers.get("content-security-policy")).toBe("sandbox");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
  });
});
