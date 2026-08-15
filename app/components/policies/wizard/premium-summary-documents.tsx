import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, FileTypeIcon, MailIcon } from "lucide-react";
import { PreviewDialog } from "~/components/documents/pdf/preview";
import { EmailDocumentsDialog } from "~/components/email/email-documents-dialog";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { usePolicyDocumentPreview } from "~/hooks/use-policy-document-preview";
import type { CarWording, Policy, PolicyDocument } from "~/lib/db/types";
import { formatDocumentLabel } from "~/lib/documents/document-label";
import {
  DEFAULT_EMAIL_TEMPLATES,
  resolveBrokerTemplateKey,
  type EmailSendRecipient,
  type EmailTemplate,
  type EmailTemplateVars,
} from "~/lib/email/templates";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import { isPremiumExcelDocument } from "~/lib/excel/excel-client";
import { versionPolicyDocuments } from "~/lib/services/policy/documents/versions";

export function PremiumSummaryDocuments({
  documents,
  isGeneratingDocuments = false,
  policyNumber,
  clientName = "",
  brokerName = "",
  brokerEmail = "",
  emailTemplates = [],
  emailDirectory = [],
  emailTemplateVars,
  footerImageWidth,
  policy,
  getPreviewPolicy,
  carWording,
  brokerFeeLines,
  documentsOnly = false,
}: {
  documents: PolicyDocument[];
  isGeneratingDocuments?: boolean;
  policyNumber: string;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  emailTemplates?: EmailTemplate[];
  emailDirectory?: EmailDirectoryEntry[];
  emailTemplateVars?: EmailTemplateVars;
  footerImageWidth?: number;
  policy?: Policy;
  getPreviewPolicy?: () => Policy | null;
  carWording?: CarWording[];
  brokerFeeLines?: Array<{
    name: string;
    sortOrder: number;
    fee: number;
    feeGst: number;
  }>;
  documentsOnly?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPreviousVersions, setShowPreviousVersions] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] =
    useState<EmailSendRecipient>("broker");
  const [previewDoc, setPreviewDoc] = useState<PolicyDocument | null>(null);

  const { previewSrc, previewLoading, previewError } = usePolicyDocumentPreview(
    {
      previewDoc,
      policy,
      getPreviewPolicy,
      carWording,
      brokerFeeLines,
    },
  );

  const { documentRows, hasPreviousVersions, visibleIdKey } = useMemo(() => {
    const allRows = versionPolicyDocuments(documents).filter(
      (row) => !isPremiumExcelDocument(row.doc),
    );
    const rows = showPreviousVersions
      ? allRows
      : allRows.filter((row) => row.isLatest);
    const visibleIds = rows.map((row) => row.doc.policyDocumentId);
    return {
      documentRows: rows,
      hasPreviousVersions: allRows.some((row) => !row.isLatest),
      visibleIdKey: visibleIds
        .slice()
        .sort((a, b) => a - b)
        .join(","),
    };
  }, [documents, showPreviousVersions]);

  const lastVisibleIdKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastVisibleIdKeyRef.current === visibleIdKey) return;
    lastVisibleIdKeyRef.current = visibleIdKey;
    const visible = new Set(
      visibleIdKey ? visibleIdKey.split(",").map(Number) : [],
    );
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [visibleIdKey]);

  const allSelected =
    documentRows.length > 0 &&
    documentRows.every((row) => selectedIds.includes(row.doc.policyDocumentId));

  const selectedDocs = documentRows
    .filter((row) => selectedIds.includes(row.doc.policyDocumentId))
    .map((row) => row.doc);

  const brokerTemplateKey = resolveBrokerTemplateKey({
    coverTypeId: policy?.car?.coverTypeId ?? 1,
    policyCategoryId: policy?.policyCategoryId ?? 1,
  });
  const brokerTemplate = emailTemplates.find(
    (t) => t.recipientType === brokerTemplateKey,
  ) ?? {
    recipientType: brokerTemplateKey,
    ...DEFAULT_EMAIL_TEMPLATES[brokerTemplateKey],
  };
  const insurerTemplate = emailTemplates.find(
    (t) => t.recipientType === "insurer",
  ) ?? {
    recipientType: "insurer" as const,
    ...DEFAULT_EMAIL_TEMPLATES.insurer,
  };
  const activeTemplate =
    emailRecipient === "insurer" ? insurerTemplate : brokerTemplate;
  const activeDefaultTo =
    emailRecipient === "insurer" ? insurerTemplate.toEmail : brokerEmail;

  function toggleDoc(id: number, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(
      checked ? documentRows.map((row) => row.doc.policyDocumentId) : [],
    );
  }

  function handleDocumentActivate(doc: PolicyDocument) {
    setPreviewDoc(doc);
  }

  function openEmail(recipient: EmailSendRecipient) {
    setEmailRecipient(recipient);
    window.setTimeout(() => setEmailOpen(true), 0);
  }

  return (
    <div
      data-policy-documents
      className={
        documentsOnly
          ? "flex flex-col gap-2"
          : "flex flex-col gap-2 border-t border-border pt-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <DropdownMenu>
          <ButtonGroup>
            {hasPreviousVersions ? (
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-medium"
                  >
                    Documents ({documentRows.length})
                  </Button>
                }
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-medium"
                disabled={documentRows.length === 0}
              >
                Documents ({documentRows.length})
              </Button>
            )}
            <DropdownMenuTrigger
              disabled={!hasPreviousVersions}
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Document options"
                  disabled={!hasPreviousVersions}
                >
                  <ChevronDownIcon aria-hidden="true" />
                </Button>
              }
            />
          </ButtonGroup>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuCheckboxItem
              checked={showPreviousVersions}
              disabled={!hasPreviousVersions}
              onCheckedChange={(checked) => setShowPreviousVersions(checked)}
            >
              Show previous versions
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {documentRows.length > 0 ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => toggleAll(Boolean(checked))}
              aria-label="Select all documents"
            />
            Select all
          </label>
        ) : null}
      </div>

      {documentRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {isGeneratingDocuments
            ? "Generating PDFs…"
            : "Documents are generated after premium is calculated."}
        </p>
      ) : (
        <>
          <ScrollArea className="h-48 rounded-md border border-border">
            <ul className="flex flex-col gap-1 p-2">
              {documentRows.map(({ doc, version }) => {
                const checked = selectedIds.includes(doc.policyDocumentId);
                const shortName = formatDocumentLabel(doc.name);
                return (
                  <li key={doc.policyDocumentId}>
                    <div className="relative flex items-start gap-2 rounded-md px-1 py-1 pe-9 hover:bg-muted/60">
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleDoc(doc.policyDocumentId, Boolean(value))
                        }
                        aria-label={`Select ${shortName} version ${version}`}
                      />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-start gap-2 text-left"
                              onClick={() => handleDocumentActivate(doc)}
                            />
                          }
                        >
                          <FileTypeIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground underline-offset-2 hover:underline">
                              {shortName}
                            </span>
                            <span className="mt-0.5 block text-xs break-all text-muted-foreground xl:hidden">
                              {doc.filename}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          {doc.filename}
                        </TooltipContent>
                      </Tooltip>
                      <Badge
                        variant="secondary"
                        size="xs"
                        className="absolute top-1 right-1.5"
                        aria-label={`Version ${version}`}
                      >
                        v{version}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
          <DropdownMenu>
            <ButtonGroup className="w-full">
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={selectedDocs.length === 0}
                  >
                    <MailIcon data-icon="inline-start" />
                    Email selected ({selectedDocs.length})
                  </Button>
                }
              />
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    aria-label="Email recipient options"
                    disabled={selectedDocs.length === 0}
                  >
                    <ChevronDownIcon aria-hidden="true" />
                  </Button>
                }
              />
            </ButtonGroup>
            <DropdownMenuContent align="start" className="max-w-80 min-w-48">
              <DropdownMenuItem onClick={() => openEmail("broker")}>
                <MailIcon />
                <span className="truncate">
                  {brokerName.trim()
                    ? `Broker: ${brokerName.trim()}`
                    : "Broker"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEmail("insurer")}>
                <MailIcon />
                Insurer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EmailDocumentsDialog
            open={emailOpen}
            onOpenChange={setEmailOpen}
            policyId={policy?.policyId ?? ""}
            documents={selectedDocs}
            policyNumber={policyNumber}
            clientName={clientName}
            brokerName={brokerName}
            brokerEmail={brokerEmail}
            recipientType={emailRecipient}
            template={activeTemplate}
            defaultTo={activeDefaultTo}
            templateVars={emailTemplateVars}
            footerImageDataUri={emailTemplateVars?.footerImage}
            footerImageWidth={footerImageWidth}
            emailDirectory={emailDirectory}
          />
          <PreviewDialog
            open={previewDoc != null}
            onOpenChange={(open) => {
              if (!open) setPreviewDoc(null);
            }}
            title={previewDoc?.name ?? "Document preview"}
            description={previewDoc?.filename}
            src={previewSrc}
            loading={previewLoading}
            error={previewError}
          />
        </>
      )}
    </div>
  );
}
