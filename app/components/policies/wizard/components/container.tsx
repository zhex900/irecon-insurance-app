import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { wizardModeCardBorderClass, type WizardMode } from "../shared/shared";
import { POLICY_STICKY_RAIL_CLASS } from "~/components/policies/policy-form-layout";

export type ContainerProps = {
  children: ReactNode;
  wizardMode: WizardMode;
  className?: string;
};

export function Container({ children, wizardMode, className }: ContainerProps) {
  const borderClassName = wizardModeCardBorderClass(wizardMode);

  return (
    <div
      className={cn(
        // Bleed into app content padding. On xl, lock height under the app
        // header so side rails stay put and only the centre form scrolls.
        "-mx-4 -mt-4 flex flex-col gap-4 md:-mx-8 md:-mt-8",
        "xl:-mb-4 xl:h-[calc(100svh-3.5rem)] xl:min-h-0 xl:overflow-hidden md:xl:-mb-8",
        // Keep cards within the column — no horizontal scrollbars.
        "[&_[data-slot=card]]:overflow-x-hidden",
        wizardMode === "view" &&
          "[&_[data-slot=card]]:bg-muted/40 [&_input]:bg-muted/30 [&_select]:bg-muted/30 [&_textarea]:bg-muted/30",
        borderClassName,
        className,
      )}
      data-wizard-mode={wizardMode}
    >
      {children}
    </div>
  );
}

export type CarPolicyWizardHeaderProps = {
  className?: string;
  policyNumber: string;
  clientId: string;
  clientName: string;
  coverTypeName?: string;
  selectedStatus?: { policyStatusId: number; name: string };
  saveStatus?: string;
  adjusted: boolean;
  headerActions?: ReactNode;
  submitDisabled: boolean;
  submitBusy: boolean;
  onRequestSubmit: () => void;
  navItems: Array<{ id: string; label: string }>;
  activeSectionId: string;
  onNavigateSection: (sectionId: string) => void;
  sectionIssueCounts: Record<string, number>;
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
};

export type CarPolicyWizardDesktopRailProps = {
  className?: string;
  navItems: Array<{ id: string; label: string }>;
  activeSectionId: string;
  openMap: Record<string, boolean>;
  onNavigateSection: (sectionId: string) => void;
  onToggleSection: (sectionId: string, open: boolean) => void;
  invalidIssues: Record<string, string | null>;
  sectionIssueCounts: Record<string, number>;
  onNavigateToIssue: (path: string) => void;
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorId: string;
  }>;
  noteAuthors: Record<string, { id: string; fullName: string }>;
  policyIsDraft: boolean;
  onAddNote: (content: string) => void;
  onUpdateNote: (id: string, content: string) => void;
  noteBusy: boolean;
  noteError: string | null;
};

export type CarPolicyWizardMainContentProps = {
  children: ReactNode;
  className?: string;
};

export function CarPolicyWizardMainContent({
  children,
  className,
}: CarPolicyWizardMainContentProps) {
  return (
    <div
      data-policy-form-scroll
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type CarPolicyWizardPremiumAsideProps = {
  className?: string;
  children: ReactNode;
};

export function CarPolicyWizardPremiumAside({
  children,
  className,
}: CarPolicyWizardPremiumAsideProps) {
  return (
    <aside
      className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS, className)}
    >
      {children}
    </aside>
  );
}

export type CarPolicyWizardGridProps = {
  children: ReactNode;
  className?: string;
};

export function CarPolicyWizardGrid({
  children,
  className,
}: CarPolicyWizardGridProps) {
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
