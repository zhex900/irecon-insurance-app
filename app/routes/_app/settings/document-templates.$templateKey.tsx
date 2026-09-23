import { lazy, Suspense } from "react";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { EditorShell } from "~/components/documents/templates/loading";
import { pageTitle } from "~/lib/brand";
import type { DocumentTemplateEditorLoaderData } from "~/lib/documents/template-editor-types";
import {
  documentTemplateAction,
  loadDocumentTemplateEditor,
} from "~/lib/services/documents/document-template-editor.server";

import type { Route } from "./+types/document-templates.$templateKey";

const DocumentTemplateEditor = lazy(() =>
  import("~/components/documents/templates/editor").then((module) => ({
    default: module.DocumentTemplateEditor,
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

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "autosave") {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function DocumentTemplateEditorRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <Suspense
      fallback={<EditorShell templateTitle={loaderData.template.title} />}
    >
      <DocumentTemplateEditor
        key={loaderData.template.key}
        loaderData={loaderData as unknown as DocumentTemplateEditorLoaderData}
      />
    </Suspense>
  );
}
