import { LoadingButton } from "~/components/ui/loading-button";
import { StatusBadge } from "~/components/ui/status-badge";
import { PolicyStickyHeader } from "~/components/policies/policy-form-layout";
import type { PolicySaveStatus } from "~/components/forms/field-save-highlight";
import { PolicySaveStatusBadge } from "~/components/forms/field-save-highlight";
import { MobileSectionNav } from "./mobile-section-nav";
import { wizardModeBadge, wizardModeHeaderClass } from "../shared/shared";
import { useMode } from "../hooks/use-mode";
import { cn } from "~/lib/utils";
import type { ReactNode } from "react";

export type CarPolicyWizardHeaderProps = {
  policyNumber: string;
  clientId: string;
  clientName: string;
  coverTypeName?: string;
  selectedStatus?: { policyStatusId: number; name: string };
  saveStatus: PolicySaveStatus;
  adjusted: boolean;
  headerActions?: ReactNode;
  submitDisabled: boolean;
  submitBusy: boolean;
  onRequestSubmit: () => void;
  navItems: { id: string; label: string }[];
  activeSectionId: string;
  onNavigateSection: (sectionId: string) => void;
  sectionIssueCounts: Record<string, number>;
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
};

export function Header({
  policyNumber,
  clientId,
  clientName,
  coverTypeName,
  selectedStatus,
  saveStatus,
  adjusted,
  headerActions,
  submitDisabled,
  submitBusy,
  onRequestSubmit,
  navItems,
  activeSectionId,
  onNavigateSection,
  sectionIssueCounts,
  onNavigateToSectionFirstIssue,
}: CarPolicyWizardHeaderProps) {
  const { wizardMode, canShowSubmitButton } = useMode();
  return (
    <div
      className={cn(
        "sticky top-14 z-20 shrink-0 border-b border-border backdrop-blur",
        "xl:static xl:backdrop-blur-none",
        wizardModeHeaderClass(wizardMode),
      )}
    >
      <PolicyStickyHeader
        policyNumber={policyNumber}
        clientId={clientId}
        clientName={clientName || "Client"}
        coverTypeName={coverTypeName}
        className="static border-0 bg-transparent backdrop-blur-none"
        modeBadge={wizardModeBadge(wizardMode)}
        breadcrumbs={[
          { label: "Clients", to: "/clients" },
          {
            label: clientName || "Client",
            to: `/clients/${clientId}`,
          },
          { label: policyNumber },
        ]}
        statusBadge={
          selectedStatus ? (
            <StatusBadge
              statusId={selectedStatus.policyStatusId}
              name={selectedStatus.name}
            />
          ) : null
        }
        saveStatus={
          wizardMode !== "view" ? (
            <PolicySaveStatusBadge status={saveStatus} />
          ) : null
        }
        adjusted={adjusted}
        actions={headerActions}
        expandControl={
          canShowSubmitButton ? (
            <LoadingButton
              type="button"
              size="sm"
              disabled={submitDisabled}
              onClick={onRequestSubmit}
              loading={submitBusy}
            >
              Submit
            </LoadingButton>
          ) : null
        }
      />
      <div className="border-t border-border px-4 py-2 md:px-8 xl:hidden">
        <MobileSectionNav
          items={navItems}
          activeSectionId={activeSectionId}
          onNavigate={onNavigateSection}
          sectionIssueCounts={sectionIssueCounts}
          onNavigateToSectionFirstIssue={onNavigateToSectionFirstIssue}
        />
      </div>
    </div>
  );
}
