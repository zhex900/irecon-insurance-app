import type { Template } from "@pdfme/common";

import type { FlowPushDown } from "~/lib/pdf/flow-push-down";
import type { DocumentTemplateHistoryEntry } from "~/lib/services/documents/document-template-history";

/** Loader payload shape for the document template editor (client-safe). */
export type DocumentTemplateEditorLoaderData = {
  canEdit: boolean;
  canDelete: boolean;
  canUndo: boolean;
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
  publishedVersionNumber: number | null;
  viewerName: string;
  history: DocumentTemplateHistoryEntry[];
  template: {
    key: string;
    title: string;
    label: string;
    coverTypeId: number | null;
    flowPushDown: FlowPushDown | null;
    mergeFields: string[];
    template: Template;
  };
};
