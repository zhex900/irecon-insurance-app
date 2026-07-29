import type { Template } from "@pdfme/common";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";

/** Published or editable pdfme template resolved from Postgres. */
export type DocumentTemplateSlot = {
  key: string;
  coverTypeId: number | null;
  title: string;
  versionNumber: number;
  mergeFields: string[];
  flowPushDown?: FlowPushDown | null;
  template: Template;
};
