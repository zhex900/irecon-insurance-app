import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, FileTypeIcon, MailIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/reui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type {
  CarAdjustmentRecord,
  CarWording,
  PolicyDocument,
  PremiumBreakdown,
  Policy,
} from "~/lib/db/types";
import { formatDocumentLabel } from "~/lib/documents/document-label";
import { formatCurrency } from "~/lib/utils";
import { PdfPreviewDialog } from "~/components/pdf-preview-dialog";
import { buildPdfBlobFromDocument } from "~/lib/pdf/generate";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import { EmailDocumentsDialog } from "~/components/forms/email-documents-dialog";
import {
  DEFAULT_EMAIL_TEMPLATES,
  resolveBrokerTemplateKey,
  type EmailSendRecipient,
  type EmailTemplate,
  type EmailTemplateVars,
} from "~/lib/email-templates";
import type { EmailDirectoryEntry } from "~/lib/email/directory";

export function PremiumSummaryPanel({
  premium,
  referralReasons,
  isCalculating,
  documents = [],
  isGeneratingDocuments = false,
  policyNumber,
  clientName = "",
  brokerName = "",
  brokerEmail = "",
  emailTemplates = [],
  emailDirectory = [],
  emailTemplateVars,
  footerImageWidth,
  adjustment,
  policy,
  /** Prefer live form+premium snapshot so schedule/rating show manual overrides. */
  getPreviewPolicy,
  /** DB Additional Wording catalogue — resolves ticked IDs in PDF preview. */
  carWording,
  className,
  /** When true, only the Documents block (for &lt;xl main column). */
  documentsOnly = false,
}: {
  premium?: PremiumBreakdown;
  referralReasons?: string[];
  isCalculating?: boolean;
  documents?: PolicyDocument[];
  isGeneratingDocuments?: boolean;
  policyNumber: string;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  emailTemplates?: EmailTemplate[];
  emailDirectory?: EmailDirectoryEntry[];
  emailTemplateVars?: EmailTemplateVars;
  footerImageWidth?: number;
  adjustment?: CarAdjustmentRecord;
  policy?: Policy;
  getPreviewPolicy?: () => Policy | null;
  carWording?: CarWording[];
  className?: string;
  documentsOnly?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPreviousVersions, setShowPreviousVersions] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] =
    useState<EmailSendRecipient>("broker");
  const [previewDoc, setPreviewDoc] = useState<PolicyDocument | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Version index per document type (oldest = 1). List newest first.
  const { documentRows, hasPreviousVersions, visibleIdKey } = useMemo(() => {
    const versionById = new Map<number, number>();
    const groups = new Map<string, PolicyDocument[]>();
    for (const doc of documents) {
      const key = doc.templateKey
        ? `template:${doc.templateKey}`
        : doc.libraryDocumentId != null
          ? `library:${doc.libraryDocumentId}`
          : `fixed:${doc.filename}`;
      const group = groups.get(key) ?? [];
      group.push(doc);
      groups.set(key, group);
    }
    const latestIds = new Set<number>();
    for (const group of groups.values()) {
      const ordered = [...group].sort(
        (a, b) => a.policyDocumentId - b.policyDocumentId,
      );
      ordered.forEach((doc, index) => {
        versionById.set(doc.policyDocumentId, index + 1);
      });
      const latest = ordered[ordered.length - 1];
      if (latest) latestIds.add(latest.policyDocumentId);
    }
    const allRows = [...documents]
      .sort((a, b) => b.policyDocumentId - a.policyDocumentId)
      .map((doc) => ({
        doc,
        version: versionById.get(doc.policyDocumentId) ?? 1,
      }));
    const rows = showPreviousVersions
      ? allRows
      : allRows.filter((row) => latestIds.has(row.doc.policyDocumentId));
    const visibleIds = rows.map((row) => row.doc.policyDocumentId);
    return {
      documentRows: rows,
      hasPreviousVersions: allRows.length > latestIds.size,
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

  const hadPreviewDocRef = useRef(false);
  const lastPreviewRequestRef = useRef<{
    doc: PolicyDocument;
    fingerprint: string;
  } | null>(null);
  useEffect(() => {
    if (!previewDoc) {
      lastPreviewRequestRef.current = null;
      if (hadPreviewDocRef.current) {
        hadPreviewDocRef.current = false;
        setPreviewSrc(null);
        setPreviewLoading(false);
        setPreviewError(null);
      }
      return;
    }
    const previewPolicy = getPreviewPolicy?.() ?? policy;
    const fingerprint = previewPolicy
      ? reviewDocumentsFingerprint(previewPolicy)
      : "";
    const previousRequest = lastPreviewRequestRef.current;
    if (
      previousRequest?.doc === previewDoc &&
      previousRequest.fingerprint === fingerprint
    ) {
      return;
    }
    lastPreviewRequestRef.current = { doc: previewDoc, fingerprint };
    hadPreviewDocRef.current = true;

    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSrc(null);

    void buildPdfBlobFromDocument(previewDoc, previewPolicy ?? undefined, {
      wordingCatalogue: carWording,
    })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
        setPreviewLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(
          err instanceof Error ? err.message : "Failed to load PDF",
        );
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewDoc, policy, getPreviewPolicy, premium, carWording]);

  const allSelected =
    documentRows.length > 0 && selectedIds.length === documentRows.length;

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

  const contractWorksTotal = adjustment
    ? adjustment.adjustedContractWorksTotalPremium
    : premium?.contractWorksTotalPremium;
  const liabilityTotal = adjustment
    ? adjustment.adjustedLiabilityTotalPremium
    : premium?.liabilityTotalPremium;
  const effectiveTotal =
    premium && adjustment
      ? premium.originalTotalPremium + adjustment.adjustedTotalPremium
      : premium?.originalTotalPremium;

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

  function openEmail(recipient: EmailSendRecipient) {
    setEmailRecipient(recipient);
    // Open composer after the menu closes so focus/portal don't clash.
    window.setTimeout(() => setEmailOpen(true), 0);
  }

  const documentsBlock = (
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

      {isGeneratingDocuments ? (
        <p className="text-xs text-muted-foreground">Generating PDFs…</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Documents are generated after premium is calculated.
        </p>
      ) : (
        <>
          <ScrollArea className="h-48 rounded-md border border-border">
            <ul className="flex flex-col gap-1 p-2">
              {documentRows.map(({ doc, version }) => {
                const checked = selectedIds.includes(doc.policyDocumentId);
                const shortName = formatDocumentLabel(doc.name);
                const showVersion = hasPreviousVersions || version > 1;
                return (
                  <li key={doc.policyDocumentId}>
                    <div className="relative flex items-start gap-2 rounded-md px-1 py-1 pe-9 hover:bg-muted/60">
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleDoc(doc.policyDocumentId, Boolean(value))
                        }
                        aria-label={
                          showVersion
                            ? `Select ${shortName} version ${version}`
                            : `Select ${shortName}`
                        }
                      />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-start gap-2 text-left"
                              onClick={() => setPreviewDoc(doc)}
                            />
                          }
                        >
                          <FileTypeIcon className="mt-0.5 size-3.5 shrink-0 text-red-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground underline-offset-2 hover:underline">
                              {shortName}
                            </span>
                            {/* Mobile: full filename under the label (wraps; no hover tooltip). */}
                            <span className="mt-0.5 block text-xs break-all text-muted-foreground xl:hidden">
                              {doc.filename}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          {doc.filename}
                        </TooltipContent>
                      </Tooltip>
                      {showVersion ? (
                        <Badge
                          variant="secondary"
                          size="xs"
                          className="absolute top-1 right-1.5"
                          aria-label={`Version ${version}`}
                        >
                          v{version}
                        </Badge>
                      ) : null}
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
            policyId={policy?.policyId ?? 0}
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
          <PdfPreviewDialog
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

  if (documentsOnly) {
    return (
      <Card className={className} data-policy-documents-card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {documentsBlock}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle>Premium Summary</CardTitle>
        {isCalculating && premium ? (
          <span className="text-xs font-normal text-muted-foreground">
            Updating…
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {premium &&
        contractWorksTotal != null &&
        liabilityTotal != null &&
        effectiveTotal != null ? (
          <>
            <Row
              label={
                adjustment
                  ? "Contract works (adjusted)"
                  : "Contract works total"
              }
              value={contractWorksTotal}
            />
            <Row
              label={
                adjustment
                  ? "Legal liability (adjusted)"
                  : "Legal liability total"
              }
              value={liabilityTotal}
            />
            <Row label="Broker fees" value={premium.combinedBrokerFee} />
            {adjustment ? (
              <>
                <Row
                  label="Original total"
                  value={premium.originalTotalPremium}
                />
                <Row
                  label="Adjustment delta"
                  value={adjustment.adjustedTotalPremium}
                />
              </>
            ) : null}
            <div className="border-t border-border pt-3 font-semibold">
              <Row
                label={adjustment ? "Effective total premium" : "Total premium"}
                value={effectiveTotal}
                strong
              />
            </div>
          </>
        ) : isCalculating ? (
          <p className="text-muted-foreground">Calculating premium…</p>
        ) : (
          <p className="text-muted-foreground">
            Complete pricing fields to see premium.
          </p>
        )}
        {referralReasons && referralReasons.length > 0 ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-warning-foreground">
            <p className="font-medium">Referral reasons</p>
            <ul className="mt-2 list-disc pl-5">
              {referralReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {documentsBlock}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 text-foreground ${strong ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
