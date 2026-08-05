import { PremiumSummaryPanel } from "./sections";
import type {
  CarAdjustmentRecord,
  CarWording,
  Policy,
  PremiumBreakdown,
} from "~/lib/db/types";
import type { PolicyDocument } from "~/lib/db/types";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import type { EmailTemplate, EmailTemplateVars } from "~/lib/email/templates";

export type CarPolicyWizardPremiumPanelProps = {
  documentsOnly?: boolean;
  premium?: PremiumBreakdown;
  referralReasons?: string[];
  isCalculating?: boolean;
  documents: PolicyDocument[];
  isGeneratingDocuments: boolean;
  policyNumber: string;
  clientName: string;
  brokerName: string;
  brokerEmail: string;
  emailTemplates: EmailTemplate[];
  emailDirectory: EmailDirectoryEntry[];
  emailTemplateVars?: EmailTemplateVars;
  footerImageWidth?: number;
  policy: Policy;
  getPreviewPolicy: () => Policy | null;
  carWording: CarWording[];
  brokerFeeLines: Array<{
    name: string;
    sortOrder: number;
    fee: number;
    feeGst: number;
  }>;
  adjustment?: CarAdjustmentRecord;
  className?: string;
};

export function CarPolicyWizardPremiumPanel(
  props: CarPolicyWizardPremiumPanelProps,
) {
  return <PremiumSummaryPanel {...props} />;
}
