import type { UsePolicyDocumentsProps } from "../documents/document-utils";
import { useCoverTypeDocumentSync } from "../documents/use-cover-type-sync";
import { useDocumentRegeneration } from "../documents/use-document-regeneration";
import { useDocumentSnapshot } from "../documents/use-document-snapshot";
import { useDocumentState } from "../documents/use-document-state";
import { usePremiumExcelExport } from "../documents/use-excel-export";

export function usePolicyDocuments({
  policy,
  form,
  premium,
  premiumRef,
  premiumManualKeysRef,
  referralReasons,
  rating,
  carWording,
  brokerFeeLines,
}: UsePolicyDocumentsProps) {
  const { documents, setDocuments, documentsRef, policyRef, generatedBy } =
    useDocumentState({ policy });

  const { buildDocumentSnapshot, formDataChangedForDocuments } =
    useDocumentSnapshot({
      policy,
      form,
      premium,
      premiumRef,
      premiumManualKeysRef,
      rating,
      referralReasons,
      carWording,
      documentsRef,
    });

  const { isGeneratingDocuments, regenerateDocumentsIfNeeded } =
    useDocumentRegeneration({
      buildDocumentSnapshot,
      generatedBy,
      brokerFeeLines,
      documentsRef,
      setDocuments,
    });

  useCoverTypeDocumentSync({
    policy,
    form,
    documentsRef,
    setDocuments,
    regenerateDocumentsIfNeeded,
  });

  const { isExportingExcel, exportPremiumExcel } = usePremiumExcelExport({
    policyRef,
    buildDocumentSnapshot,
  });

  return {
    documents,
    isGeneratingDocuments,
    isExportingExcel,
    exportPremiumExcel,
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    buildDocumentSnapshot,
  };
}
