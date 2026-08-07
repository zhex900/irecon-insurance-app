import { LoadingButton } from "~/components/ui/loading-button";
import { StatusBadge } from "~/components/ui/status-badge";
import { PolicyStickyHeader } from "~/components/policies/policy-form-layout";
import type { PolicySaveStatus } from "~/components/forms/field-save-highlight";
import { PolicySaveStatusBadge } from "~/components/forms/field-save-highlight";
import { MobileSectionNav } from "./section-stack";
import {
  wizardModeBadge,
  wizardModeHeaderClass,
  type WizardMode,
} from "./car-policy-wizard-shared";
import { cn } from "~/lib/utils";
import type { ReactNode } from "react";

export type CarPolicyWizardHeaderProps = {
  wizardMode: WizardMode;
  policyNumber: string;
  clientId: string;
  clientName: string;
  coverTypeName?: string;
  selectedStatus?: { policyStatusId: number; name: string };
  saveStatus: PolicySaveStatus;
  adjusted: boolean;
  headerActions?: ReactNode;
  readOnly: boolean;
  isFormTerminal: boolean;
  submitDisabled: boolean;
  submitBusy: boolean;
  onRequestSubmit: () => void;
  navItems: { id: string; label: string }[];
  activeSectionId: string;
  onNavigateSection: (sectionId: string) => void;
  sectionIssueCounts: Record<string, number>;
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
};

export function CarPolicyWizardHeader({
  wizardMode,
  policyNumber,
  clientId,
  clientName,
  coverTypeName,
  selectedStatus,
  saveStatus,
  adjusted,
  headerActions,
  readOnly,
  isFormTerminal,
  submitDisabled,
  submitBusy,
  onRequestSubmit,
  navItems,
  activeSectionId,
  onNavigateSection,
  sectionIssueCounts,
  onNavigateToSectionFirstIssue,
}: CarPolicyWizardHeaderProps) {
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
          !readOnly && !isFormTerminal ? (
            <LoadingButton
              type="button"
              size="sm"
              disabled={submitDisabled}
              onClick={onRequestSubmit}
              loading={submitBusy}
              loadingLabel="Submitting…"
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
