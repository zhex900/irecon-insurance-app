import { useRef, useState, type ComponentType } from "react";
import { Link, redirect } from "react-router";
import {
  ArrowRightIcon,
  Building2Icon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  UsersIcon,
  type LucideProps,
} from "lucide-react";
import { toast } from "sonner";
import { AppErrorPage } from "~/components/app-error-page";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
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
  EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
  EMAIL_FOOTER_DISPLAY_WIDTH_MAX,
  EMAIL_FOOTER_DISPLAY_WIDTH_MIN,
  EMAIL_FOOTER_DISPLAY_WIDTH_STEP,
} from "~/lib/email/footer-display";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  type EmailTemplate,
  type EmailTemplateKey,
} from "~/lib/email/templates";
import { getEmailFooterDisplayWidth } from "~/lib/services/email/footer-image.server";
import { listEmailTemplates } from "~/lib/services/email/templates.server";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
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

  // Keep this loader light — do not embed the ~200KB footer data URI here.
  // The footer card loads the image from `/api/email-footer` instead.
  return {
    templates: await listEmailTemplates(),
    canEdit: isSuperAdmin(viewer),
    emailTemplatesEnabled,
    footerDisplayWidth: await getEmailFooterDisplayWidth(),
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
    <Link
      to={href}
      className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
    </Link>
  );
}

function EmailFooterCard({
  canEdit,
  initialDisplayWidth,
}: {
  canEdit: boolean;
  initialDisplayWidth: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState("/api/email-footer");
  const [widthOverride, setWidthOverride] = useState<number | null>(null);
  const displayWidth = widthOverride ?? initialDisplayWidth;
  const [busy, setBusy] = useState(false);

  function refreshPreview() {
    setPreviewSrc(`/api/email-footer?t=${Date.now()}`);
  }

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
      refreshPreview();
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
      refreshPreview();
      toast.success("Restored default footer image");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restore default.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveWidth(nextWidth: number) {
    if (!canEdit) return;
    const previous = widthOverride;
    setWidthOverride(nextWidth);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("intent", "width");
      body.set("displayWidth", String(nextWidth));
      const response = await fetch("/api/email-footer", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        displayWidth?: number;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not save scale.");
      }
      if (typeof data?.displayWidth === "number") {
        setWidthOverride(data.displayWidth);
      }
      toast.success(`Footer width ${data?.displayWidth ?? nextWidth}px`);
    } catch (error) {
      setWidthOverride(previous);
      toast.error(
        error instanceof Error ? error.message : "Could not save scale.",
      );
    } finally {
      setBusy(false);
    }
  }

  const scalePercent = Math.round(
    (displayWidth / EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT) * 100,
  );

  return (
    <Card className="max-w-3xl">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Email Footer Image</CardTitle>
              <CardDescription>
                Stored in the database as an image blob. Templates use{" "}
                {"{{footerImage}}"}. Scale sets the width in Visual, Preview,
                and sent mail.
              </CardDescription>
            </div>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-white p-3">
          <img
            src={previewSrc}
            alt="Email footer"
            width={displayWidth}
            style={{
              width: displayWidth,
              maxWidth: "100%",
              height: "auto",
              display: "block",
            }}
            className="rounded border border-transparent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Scale</span>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  !canEdit ||
                  busy ||
                  displayWidth <= EMAIL_FOOTER_DISPLAY_WIDTH_MIN
                }
                onClick={() =>
                  void saveWidth(displayWidth - EMAIL_FOOTER_DISPLAY_WIDTH_STEP)
                }
                title="Smaller"
              >
                <MinusIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-24 tabular-nums"
                disabled
              >
                {displayWidth}px · {scalePercent}%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  !canEdit ||
                  busy ||
                  displayWidth >= EMAIL_FOOTER_DISPLAY_WIDTH_MAX
                }
                onClick={() =>
                  void saveWidth(displayWidth + EMAIL_FOOTER_DISPLAY_WIDTH_STEP)
                }
                title="Larger"
              >
                <PlusIcon />
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Keep the app shell / side nav; only replace this page’s content.
  return <AppErrorPage error={error} />;
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
        initialDisplayWidth={loaderData.footerDisplayWidth}
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
