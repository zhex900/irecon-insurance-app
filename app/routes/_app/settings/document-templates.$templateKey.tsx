import { DocumentTemplateEditor } from "~/components/documents/document-template-editor";
import { DocumentTemplatesEditorShell } from "~/components/documents/document-templates-loading";
import type { DocumentTemplateEditorLoaderData } from "~/lib/documents/template-editor-types";
import { pageTitle } from "~/lib/brand";
import {
  documentTemplateAction,
  loadDocumentTemplateEditor,
} from "~/lib/services/documents/document-template-editor.server";
import type { Route } from "./+types/document-templates.$templateKey";

export function meta() {
  return [{ title: pageTitle("Document Template") }];
}

export function HydrateFallback() {
  return <DocumentTemplatesEditorShell title="Document Template" />;
}

export function loader(args: Route.LoaderArgs) {
  return loadDocumentTemplateEditor(args);
}

export function action(args: Route.ActionArgs) {
  return documentTemplateAction(args);
}

export default function DocumentTemplateEditorRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <DocumentTemplateEditor
      key={loaderData.template.key}
      loaderData={loaderData as unknown as DocumentTemplateEditorLoaderData}
    />
  );
}
