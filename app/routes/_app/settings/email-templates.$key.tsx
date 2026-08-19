import { lazy, Suspense } from "react";

import { EmailTemplateEditorShell } from "~/components/email/email-template-editor-loading";
import { pageTitle } from "~/lib/brand";
import {
  emailTemplateAction,
  loadEmailTemplateEditor,
} from "~/lib/services/email/email-template-editor.server";

import type { Route } from "./+types/email-templates.$key";

const EmailTemplateEditor = lazy(() =>
  import("~/components/email/email-template-editor").then((module) => ({
    default: module.EmailTemplateEditor,
  })),
);

export function meta() {
  return [{ title: pageTitle("Email Template") }];
}

export function HydrateFallback() {
  return <EmailTemplateEditorShell />;
}

export function loader(args: Route.LoaderArgs) {
  return loadEmailTemplateEditor(args);
}

export function action(args: Route.ActionArgs) {
  return emailTemplateAction(args);
}

export default function SettingsEmailTemplateEditorRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <Suspense
      fallback={
        <EmailTemplateEditorShell
          title={loaderData.meta.title}
          description={loaderData.meta.description}
        />
      }
    >
      <EmailTemplateEditor loaderData={loaderData} />
    </Suspense>
  );
}
