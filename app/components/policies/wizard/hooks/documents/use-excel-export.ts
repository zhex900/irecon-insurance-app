import { type RefObject, useState } from "react";
import { toast } from "sonner";

import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { downloadPremiumExcelDocument } from "~/lib/excel/client";

import { parseExcelExportResponse } from "./document-utils";

export function usePremiumExcelExport(options: {
  policyRef: RefObject<Policy>;
  buildDocumentSnapshot: (premiumOverride?: PremiumBreakdown) => Policy | null;
}) {
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  async function exportPremiumExcel() {
    const snapshot = options.buildDocumentSnapshot();
    if (!snapshot?.car.premium) {
      toast.error("Premium not calculated", {
        description: "Calculate premium before exporting to Excel.",
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      const response = await fetch("/api/generate-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: options.policyRef.current.policyId }),
      });
      const result: unknown = await response.json().catch(() => null);
      const document = parseExcelExportResponse(result, response.ok);
      downloadPremiumExcelDocument({
        filename: document.filename,
        pdfBase64: document.pdfBase64,
      });
      toast.success("Excel exported", {
        description: "Downloaded to your computer.",
      });
    } catch (err: unknown) {
      toast.error("Excel export failed", {
        description:
          err instanceof Error
            ? err.message
            : "Could not generate spreadsheet.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  }

  return { isExportingExcel, exportPremiumExcel };
}
