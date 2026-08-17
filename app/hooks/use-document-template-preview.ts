import type { Template } from "@pdfme/common";
import { useCallback, useEffect, useRef, useState } from "react";

import { collectMergeFields } from "~/lib/documents/template-editor-form";
import { expandEndorsementPairSchemas } from "~/lib/pdf/endorsement-expand";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import {
  normalizePdfmeTemplateSchemas,
  syncTableSchemasToInputs,
} from "~/lib/pdf/merge-fields";
import { buildSampleMergeInputs } from "~/lib/pdf/pdf-sample-merge-inputs";
import type { DocumentTemplateHistoryEntry } from "~/lib/services/documents/document-template-history";

type PreviewDocTemplate = {
  mergeFields: string[];
  flowPushDown: FlowPushDown | null;
};

export function useDocumentTemplatePreview(docTemplate: PreviewDocTemplate) {
  const previewUrlRef = useRef<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    revokePreviewUrl();
    setPreviewOpen(false);
    setPreviewSrc(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, [revokePreviewUrl]);

  const generatePreview = useCallback(
    async (template: Template, title: string) => {
      revokePreviewUrl();
      setPreviewTitle(title);
      setPreviewOpen(true);
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewSrc(null);

      try {
        const mergeFields = collectMergeFields(
          template,
          docTemplate.mergeFields,
        );
        const inputs = buildSampleMergeInputs(
          template,
          mergeFields,
          docTemplate.flowPushDown,
        );
        const drawOps: import("~/lib/pdf/html-rich-text-draw").EndorsementRichDrawOp[] =
          [];
        const prepared = applyFlowPushDown(
          expandEndorsementPairSchemas(
            syncTableSchemasToInputs(
              normalizePdfmeTemplateSchemas(
                template as unknown as {
                  schemas: Array<Array<Record<string, unknown>>>;
                },
              ),
              inputs,
            ) as Template,
            inputs,
            drawOps,
          ),
          docTemplate.flowPushDown,
          inputs,
        );
        const [
          { generate },
          { getPdfmeFonts },
          { pdfmePlugins },
          { applyEndorsementRichDrawOps },
        ] = await Promise.all([
          import("@pdfme/generator"),
          import("~/lib/pdf/pdf-fonts"),
          import("~/lib/pdf/pdf-plugins"),
          import("~/lib/pdf/html-rich-text-draw"),
        ]);
        const font = await getPdfmeFonts();
        let pdf = await generate({
          template: prepared,
          inputs: [inputs],
          plugins: pdfmePlugins,
          options: { font },
        });
        if (drawOps.length > 0) {
          try {
            pdf = new Uint8Array(
              await applyEndorsementRichDrawOps(pdf, drawOps, font),
            ) as typeof pdf;
          } catch {
            // Keep pdfme base PDF if rich overlay fails.
          }
        }
        const blob = new Blob([pdf.buffer as ArrayBuffer], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewSrc(url);
        setPreviewLoading(false);
      } catch (error) {
        setPreviewLoading(false);
        setPreviewError(
          error instanceof Error ? error.message : "Failed to generate preview",
        );
      }
    },
    [docTemplate.flowPushDown, docTemplate.mergeFields, revokePreviewUrl],
  );

  async function fetchHistoryVersionTemplate(
    templateKey: string,
    versionNumber: number,
  ): Promise<Template> {
    const response = await fetch(
      `/api/document-templates/${encodeURIComponent(templateKey)}?version=${versionNumber}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to load v${versionNumber}`);
    }
    const data = (await response.json()) as { template: Template };
    return data.template;
  }

  const previewVersion = useCallback(
    async (templateKey: string, entry: DocumentTemplateHistoryEntry) => {
      const template = await fetchHistoryVersionTemplate(
        templateKey,
        entry.versionNumber,
      );
      await generatePreview(template, entry.title);
    },
    [generatePreview],
  );

  return {
    previewOpen,
    previewSrc,
    previewLoading,
    previewError,
    previewTitle,
    setPreviewOpen,
    closePreview,
    generatePreview,
    previewVersion,
    fetchHistoryVersionTemplate,
  };
}
