import { memo } from "react";

import { PolicySaveStatusBadge } from "~/components/forms/field-save-highlight";
import { PolicyStickyHeader } from "~/components/policies/policy-form-layout";
import { Badge } from "~/components/reui/badge";
import { LoadingButton } from "~/components/ui/loading-button";
import { StatusBadge } from "~/components/ui/status-badge";
import type { Policy, ReferenceData } from "~/lib/db/types";
import { cn } from "~/lib/utils";

import type { usePolicyWizardNavigation } from "../hooks/composite/use-navigation";
import { usePolicyPhase } from "../hooks/utils/use-mode";
import { useWizardDisplayFields } from "../hooks/wizard/use-wizard-display-fields";
import { policyPhaseHeaderClass } from "../shared/policy-phase";
import type {
  WizardDraftSlice,
  WizardSubmitSlice,
} from "./assemble-wizard-state";
import { MobileSectionNav } from "./mobile-section-nav";

type HeaderProps = {
  policy: Policy;
  reference: ReferenceData;
  clientName?: string;
  headerActions?: React.ReactNode;
  saveStatus: WizardDraftSlice["saveStatus"];
  submitDisabled: WizardSubmitSlice["submitDisabled"];
  submitBusy: WizardSubmitSlice["submitBusy"];
  requestSubmit: WizardSubmitSlice["requestSubmit"];
  navItems: Array<{ id: string; label: string }>;
  activeSectionId: string;
  onNavigate: ReturnType<typeof usePolicyWizardNavigation>["navigateToSection"];
  sectionIssueCounts: ReturnType<
    typeof usePolicyWizardNavigation
  >["sectionIssueCounts"];
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
};

export const Header = memo(function Header({
  policy,
  reference,
  clientName = "",
  headerActions,
  saveStatus,
  submitDisabled,
  submitBusy,
  requestSubmit,
  navItems,
  activeSectionId,
  onNavigate,
  sectionIssueCounts,
  onNavigateToSectionFirstIssue,
}: HeaderProps) {
  const { phase, canShowSubmitButton, canEdit } = usePolicyPhase();
  const { livePolicyNumber, coverTypeName, selectedStatus } =
    useWizardDisplayFields(policy, reference);

  const statusBadge = selectedStatus ? (
    <StatusBadge
      statusId={selectedStatus.policyStatusId}
      name={selectedStatus.name}
    />
  ) : null;

  const draftBadge =
    phase === "new" ? (
      <Badge variant="primary-light" radius="full">
        Draft
      </Badge>
    ) : null;

  return (
    <div
      className={cn(
        "sticky top-14 z-20 shrink-0 border-b border-border backdrop-blur",
        "xl:static xl:backdrop-blur-none",
        policyPhaseHeaderClass(phase),
      )}
    >
      <PolicyStickyHeader
        policyNumber={livePolicyNumber}
        clientId={policy.clientId}
        clientName={clientName || "Client"}
        coverTypeName={coverTypeName || undefined}
        className="static border-0 bg-transparent backdrop-blur-none"
        breadcrumbs={[
          { label: "Clients", to: "/clients" },
          {
            label: clientName || "Client",
            to: `/clients/${policy.clientId}`,
          },
          { label: livePolicyNumber },
        ]}
        statusBadge={
          <>
            {draftBadge}
            {statusBadge}
          </>
        }
        saveStatus={
          canEdit ? <PolicySaveStatusBadge status={saveStatus} /> : null
        }
        adjusted={Boolean(policy.car.adjusted)}
        actions={headerActions}
        expandControl={
          canShowSubmitButton ? (
            <LoadingButton
              type="button"
              size="sm"
              disabled={submitDisabled}
              onClick={() => {
                void requestSubmit();
              }}
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
          onNavigate={onNavigate}
          sectionIssueCounts={sectionIssueCounts}
          onNavigateToSectionFirstIssue={onNavigateToSectionFirstIssue}
        />
      </div>
    </div>
  );
});
