import { lazy, Suspense } from "react";
import { EditorShell } from "~/components/documents/templates/loading";
import type { DocumentTemplateEditorLoaderData } from "~/lib/documents/template-editor-types";
import { pageTitle } from "~/lib/brand";
import {
  documentTemplateAction,
  loadDocumentTemplateEditor,
} from "~/lib/services/documents/document-template-editor.server";
import type { Route } from "./+types/document-templates.$templateKey";

const DocumentTemplateEditor = lazy(() =>
  import("~/components/documents/templates/editor").then((module) => ({
    default: module.MainEditor,
  })),
);

export function meta() {
  return [{ title: pageTitle("Document Template") }];
}

export function HydrateFallback() {
  return <EditorShell templateTitle="Document Template" />;
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
    <Suspense
      fallback={
        <EditorShell
          templateTitle={loaderData.template.title}
        />
      }
    >
      <DocumentTemplateEditor
        key={loaderData.template.key}
        loaderData={loaderData as unknown as DocumentTemplateEditorLoaderData}
      />
    </Suspense>
  );
}
