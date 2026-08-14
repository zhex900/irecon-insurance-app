import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type {
  CarAdjustmentRecord,
  CarWording,
  Policy,
  PolicyDocument,
  PremiumBreakdown,
} from "~/lib/db/types";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import type { EmailTemplate, EmailTemplateVars } from "~/lib/email/templates";
import { PremiumSummaryDocuments } from "~/components/policies/wizard/premium-summary-documents";
import { PremiumSummaryTotals } from "~/components/policies/wizard/premium-summary-totals";

export function PremiumSummary({
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
  getPreviewPolicy,
  carWording,
  brokerFeeLines,
  className,
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
  brokerFeeLines?: Array<{
    name: string;
    sortOrder: number;
    fee: number;
    feeGst: number;
  }>;
  className?: string;
  documentsOnly?: boolean;
}) {
  const documentsBlock = (
    <PremiumSummaryDocuments
      documents={documents}
      isGeneratingDocuments={isGeneratingDocuments}
      policyNumber={policyNumber}
      clientName={clientName}
      brokerName={brokerName}
      brokerEmail={brokerEmail}
      emailTemplates={emailTemplates}
      emailDirectory={emailDirectory}
      emailTemplateVars={emailTemplateVars}
      footerImageWidth={footerImageWidth}
      policy={policy}
      getPreviewPolicy={getPreviewPolicy}
      carWording={carWording}
      brokerFeeLines={brokerFeeLines}
      documentsOnly={documentsOnly}
    />
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
        <PremiumSummaryTotals
          premium={premium}
          referralReasons={referralReasons}
          isCalculating={isCalculating}
          adjustment={adjustment}
        />
        {documentsBlock}
      </CardContent>
    </Card>
  );
}
