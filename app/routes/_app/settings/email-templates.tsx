import { useRef, useState, type ComponentType } from "react";
import { redirect } from "react-router";
import {
  ArrowRightIcon,
  Building2Icon,
  ImageIcon,
  UsersIcon,
  type LucideProps,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/reui/badge";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_META,
} from "~/lib/email-templates";
import { getEmailFooterDataUri } from "~/lib/services/email/footer-image";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import {
  EMAIL_TEMPLATE_KEYS,
  listEmailTemplates,
  type EmailTemplate,
  type EmailTemplateKey,
} from "~/lib/services/email/templates";
import type { Route } from "./+types/email-templates";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Email Templates") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const emailTemplatesEnabled = await isFeatureEnabled("email_templates");
  if (!emailTemplatesEnabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }
  return {
    templates: await listEmailTemplates(),
    canEdit: isSuperAdmin(viewer),
    emailTemplatesEnabled,
    footerImageDataUri: await getEmailFooterDataUri(),
  };
}

function templateForKey(
  byKey: Map<string, EmailTemplate>,
  key: EmailTemplateKey,
): EmailTemplate {
  return (
    byKey.get(key) ?? {
      recipientType: key,
      ...DEFAULT_EMAIL_TEMPLATES[key],
    }
  );
}

function TemplateSummaryCard({
  href,
  title,
  description,
  preview,
  policyTag,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  preview: string;
  policyTag: string | null;
  icon: ComponentType<LucideProps>;
}) {
  return (
    <a
      href={href}
      className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={(event) => {
        // Full page load — same as Settings index; client transitions can stall here.
        event.preventDefault();
        window.location.assign(href);
      }}
    >
      <Card className="pointer-events-none h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="flex items-center gap-2">
              {policyTag ? (
                <Badge variant="primary-light" size="sm" radius="full">
                  {policyTag}
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm" radius="full">
                  Insurer
                </Badge>
              )}
              <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {preview ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {preview}
            </p>
          ) : null}
        </CardHeader>
      </Card>
    </a>
  );
}

function EmailFooterCard({
  canEdit,
  initialDataUri,
}: {
  canEdit: boolean;
  initialDataUri: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataUri, setDataUri] = useState(initialDataUri);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/email-footer", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        dataUri?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Upload failed.");
      }
      if (!data?.dataUri) {
        throw new Error("Upload did not return an image.");
      }
      setDataUri(data.dataUri);
      toast.success("Footer image saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefault() {
    setBusy(true);
    try {
      const response = await fetch("/api/email-footer", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        dataUri?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not restore default.");
      }
      if (!data?.dataUri) {
        throw new Error("Restore did not return an image.");
      }
      setDataUri(data.dataUri);
      toast.success("Restored default footer image");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restore default.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Email Footer Image</CardTitle>
            <CardDescription>
              Stored in the database as an image blob. Templates use{" "}
              {"{{footerImage}}"} which is filled with this image (no hosted
              URL).
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dataUri ? (
            <img
              src={dataUri}
              alt="Email footer"
              className="h-12 max-w-[220px] rounded border bg-white object-contain"
            />
          ) : null}
          {canEdit ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                loading={busy}
                loadingLabel="Uploading…"
                onClick={() => inputRef.current?.click()}
              >
                Upload
              </LoadingButton>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void restoreDefault()}
              >
                Restore default
              </Button>
            </>
          ) : null}
        </div>
      </CardHeader>
    </Card>
  );
}

export default function SettingsEmailTemplatesRoute({
  loaderData,
}: Route.ComponentProps) {
  const byKey = new Map(
    loaderData.templates.map((template) => [template.recipientType, template]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email Templates"
        description={
          loaderData.emailTemplatesEnabled
            ? "Five templates: insurer plus Annual, Renewal, Single, and Owner Builder broker emails."
            : "Email Templates is disabled for other roles. Super-admins can still view and edit."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Email Templates" },
        ]}
      />

      <EmailFooterCard
        canEdit={loaderData.canEdit}
        initialDataUri={loaderData.footerImageDataUri}
      />

      <div className="grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EMAIL_TEMPLATE_KEYS.map((key) => {
          const template = templateForKey(byKey, key);
          const meta = EMAIL_TEMPLATE_META[key];
          return (
            <TemplateSummaryCard
              key={key}
              href={`/settings/email-templates/${encodeURIComponent(key)}`}
              title={meta.title}
              description={meta.description}
              preview={
                key === "insurer" && template.toEmail
                  ? `${template.toEmail} · ${template.subject}`
                  : template.subject
              }
              policyTag={meta.policyTag}
              icon={key === "insurer" ? Building2Icon : UsersIcon}
            />
          );
        })}
      </div>
    </div>
  );
}
