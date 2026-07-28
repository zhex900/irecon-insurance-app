import { useEffect, useRef, useState, type ComponentType } from "react";
import { redirect, useFetcher, useRevalidator } from "react-router";
import {
  ArrowRightIcon,
  Building2Icon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import { writeAuditLog } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import {
  EMAIL_RECIPIENT_TYPES,
  listEmailTemplates,
  saveEmailTemplate,
  type EmailRecipientType,
  type EmailTemplate,
} from "~/lib/services/email/templates";
import type { Route } from "./+types/email-templates";

export function meta() {
  return [{ title: "Email templates | BrokerSure" }];
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
  };
}

export async function action({ request }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    return {
      ok: false as const,
      error: "Only super-admins can change email templates.",
    };
  }

  const formData = await request.formData();
  const recipientType = String(
    formData.get("recipientType") ?? "",
  ) as EmailRecipientType;
  if (!EMAIL_RECIPIENT_TYPES.includes(recipientType)) {
    return { ok: false as const, error: "Unknown recipient type." };
  }

  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  const toEmail = String(formData.get("toEmail") ?? "");

  if (!subject.trim()) {
    return { ok: false as const, error: "Subject is required." };
  }
  if (!body.trim()) {
    return { ok: false as const, error: "Message body is required." };
  }
  if (recipientType === "insurer" && !toEmail.trim()) {
    return { ok: false as const, error: "Insurer email address is required." };
  }
  if (
    recipientType === "insurer" &&
    toEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim())
  ) {
    return {
      ok: false as const,
      error: "Enter a valid insurer email address.",
    };
  }

  const saved = await saveEmailTemplate(
    { recipientType, subject, body, toEmail },
    viewer.email,
  );
  await writeAuditLog({
    actor: viewer,
    action: "settings.email_template",
    entityType: "email_template",
    entityId: recipientType,
    summary: `Updated ${recipientType} email template`,
    metadata: {
      recipientType,
      hasToEmail: Boolean(saved.toEmail),
    },
    request,
  });

  return { ok: true as const, recipientType, template: saved };
}

const PLACEHOLDER_HINT =
  "Use {{clientName}}, {{policyNumber}}, and {{brokerName}} as placeholders.";

function TemplateSummaryCard({
  title,
  description,
  preview,
  icon: Icon,
  onOpen,
}: {
  title: string;
  description: string;
  preview: string;
  icon: ComponentType<LucideProps>;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block h-full w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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
    </button>
  );
}

function TemplateEditDialog({
  open,
  onOpenChange,
  title,
  description,
  template,
  showToEmail = false,
  canEdit = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  template: EmailTemplate;
  showToEmail?: boolean;
  canEdit?: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const handledDataRef = useRef<typeof fetcher.data>(undefined);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [toEmail, setToEmail] = useState(template.toEmail);
  const busy = fetcher.state !== "idle";

  // Keep dialog fields in sync when the dialog opens or loader data updates after save.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    setSubject(template.subject);
    setBody(template.body);
    setToEmail(template.toEmail);
  }, [open, template.subject, template.body, template.toEmail]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (handledDataRef.current === fetcher.data) return;
    handledDataRef.current = fetcher.data;
    const data = handledDataRef.current;

    if (data.ok && data.recipientType === template.recipientType) {
      const saved = data.template;
      setSubject(saved.subject);
      setBody(saved.body);
      setToEmail(saved.toEmail);
      toast.success(`${title} saved`);
      onOpenChange(false);
      revalidator.revalidate();
    } else if (!data.ok && "error" in data) {
      toast.error(data.error);
    }
  }, [
    fetcher.state,
    fetcher.data,
    template.recipientType,
    title,
    onOpenChange,
    revalidator,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {canEdit
              ? description
              : "View only — only super-admins can edit email templates."}
          </DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="flex flex-col gap-4">
          <input
            type="hidden"
            name="recipientType"
            value={template.recipientType}
          />
          {showToEmail ? (
            <Field>
              <FieldLabel htmlFor={`${template.recipientType}-to`}>
                Insurer email
              </FieldLabel>
              <Input
                id={`${template.recipientType}-to`}
                name="toEmail"
                type="email"
                value={toEmail}
                onChange={(event) => setToEmail(event.target.value)}
                placeholder="underwriting@insurer.com"
                autoComplete="email"
                required
                disabled={!canEdit}
                readOnly={!canEdit}
              />
            </Field>
          ) : (
            <input type="hidden" name="toEmail" value="" />
          )}
          <Field>
            <FieldLabel htmlFor={`${template.recipientType}-subject`}>
              Subject
            </FieldLabel>
            <Input
              id={`${template.recipientType}-subject`}
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              disabled={!canEdit}
              readOnly={!canEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${template.recipientType}-body`}>
              Message
            </FieldLabel>
            <Textarea
              id={`${template.recipientType}-body`}
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              className="min-h-48 font-mono text-sm"
              required
              disabled={!canEdit}
              readOnly={!canEdit}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {PLACEHOLDER_HINT}
            </p>
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit ? (
              <LoadingButton
                type="submit"
                loading={busy}
                loadingLabel="Saving…"
              >
                Save
              </LoadingButton>
            ) : null}
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsEmailTemplatesRoute({
  loaderData,
}: Route.ComponentProps) {
  const broker = loaderData.templates.find(
    (t) => t.recipientType === "broker",
  )!;
  const insurer = loaderData.templates.find(
    (t) => t.recipientType === "insurer",
  )!;
  const [openType, setOpenType] = useState<EmailRecipientType | null>(null);

  return (
    <div>
      <PageHeader
        title="Email templates"
        description={
          loaderData.emailTemplatesEnabled
            ? "Default subject and body when emailing selected policy documents to the broker or insurer."
            : "Email templates is disabled for other roles. Super-admins can still view and edit."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Email templates" },
        ]}
      />

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <TemplateSummaryCard
          title="Broker template"
          description="Sent to the client's authorised representative email address."
          preview={broker.subject}
          icon={UsersIcon}
          onOpen={() => setOpenType("broker")}
        />
        <TemplateSummaryCard
          title="Insurer template"
          description="Sent to the configured insurer email address."
          preview={
            insurer.toEmail
              ? `${insurer.toEmail} · ${insurer.subject}`
              : insurer.subject
          }
          icon={Building2Icon}
          onOpen={() => setOpenType("insurer")}
        />
      </div>

      <TemplateEditDialog
        open={openType === "broker"}
        onOpenChange={(open) => setOpenType(open ? "broker" : null)}
        title="Broker template"
        description="Edit the subject and message used when emailing documents to the broker."
        template={broker}
        canEdit={loaderData.canEdit}
      />
      <TemplateEditDialog
        open={openType === "insurer"}
        onOpenChange={(open) => setOpenType(open ? "insurer" : null)}
        title="Insurer template"
        description="Edit the insurer email address, subject, and message."
        template={insurer}
        showToEmail
        canEdit={loaderData.canEdit}
      />
    </div>
  );
}
