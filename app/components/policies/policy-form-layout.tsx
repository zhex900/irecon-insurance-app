import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { type ReactNode,useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { FilterAutocomplete } from "~/components/forms/autocomplete";
import {
  AppBreadcrumb,
  type AppBreadcrumbItem,
} from "~/components/layout/app-breadcrumb";
import { PolicyNumberField } from "~/components/policies/policy-number-field";
import {
  PolicyStatusMenu,
  type TerminalStatusValidation,
} from "~/components/policies/policy-status-menu";
import { Badge } from "~/components/reui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import { StatusBadge } from "~/components/ui/status-badge";
import { listPolicyFieldSearchOptions } from "~/lib/policies/field-labels";
import { cn } from "~/lib/utils";
import { wizardSteps } from "~/lib/zod/policy-car";

export const POLICY_FORM_SECTIONS = [
  {
    id: "risk-details",
    label: wizardSteps[0],
    description: "Cover type, site, dates, and insured contracts",
  },
  {
    id: "limits-of-liability",
    label: wizardSteps[1],
    description: "Contract works sums, sub-limits, and legal liability",
  },
  {
    id: "excesses",
    label: wizardSteps[2],
    description: "Contract works and legal liability excesses",
  },
  {
    id: "claims",
    label: wizardSteps[3],
    description: "Claims history, exclusions, declaration, and wording",
  },
  {
    id: "premium",
    label: wizardSteps[4],
    description: "Status, premium breakdown, and confirmation",
  },
] as const;

export type PolicyFormSectionId = (typeof POLICY_FORM_SECTIONS)[number]["id"];

/** Nav order depends on whether Premium is pinned under Policy Information. */
export function getPolicyFormNavItems(premiumPinned: boolean) {
  const premium = {
    id: "premium" as const,
    label: wizardSteps[4],
  };
  const rest = POLICY_FORM_SECTIONS.filter((s) => s.id !== "premium").map(
    (s) => ({
      id: s.id,
      label: s.label,
    }),
  );
  if (premiumPinned) {
    return [
      { id: "policy-information" as const, label: "Policy Information" },
      premium,
      ...rest,
    ];
  }
  return [
    { id: "policy-information" as const, label: "Policy Information" },
    ...rest,
    premium,
  ];
}

/** @deprecated Prefer getPolicyFormNavItems(premiumPinned) */
export const POLICY_FORM_NAV_ITEMS = getPolicyFormNavItems(false);

export const POLICY_FORM_NAV_IDS = getPolicyFormNavItems(false).map(
  (item) => item.id,
);

export function sectionIdForStep(stepIndex: number): PolicyFormSectionId {
  return POLICY_FORM_SECTIONS[stepIndex]?.id ?? POLICY_FORM_SECTIONS[0].id;
}

export function stepIndexForSection(sectionId: string): number | null {
  const index = POLICY_FORM_SECTIONS.findIndex((s) => s.id === sectionId);
  return index >= 0 ? index : null;
}

/**
 * Side rails in the xl fill-height shell — parent is height-locked so these
 * stay put; only the centre form column scrolls.
 */
export const POLICY_STICKY_RAIL_CLASS =
  "min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain";

/**
 * Offset for section scroll-into-view.
 * Mobile/tablet: clears sticky app bar + policy header + section tags.
 * xl: centre form scroller — chrome sits outside that scroller.
 */
export const POLICY_SECTION_SCROLL_MT_CLASS = "scroll-mt-44 xl:scroll-mt-4";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function PolicyInformationCard({
  insurerName,
  policyNumber,
  policyNumberEditable = false,
  onPolicyNumberChange,
  onPolicyNumberBlur,
  policyNumberError,
  statusId,
  statusName,
  statusOptions = [],
  canChangeStatus = false,
  onStatusChange,
  onConfirmTerminalStatus,
  validateTerminalStatus,
  onTerminalStatusInvalid,
  statusConfirmBusy = false,
  adjusted,
  className,
}: {
  insurerName: string;
  policyNumber: string;
  /** When true, suffix after the fixed prefix is editable. */
  policyNumberEditable?: boolean;
  onPolicyNumberChange?: (fullPolicyNumber: string) => void;
  onPolicyNumberBlur?: () => void;
  policyNumberError?: string;
  statusId: number;
  statusName: string;
  statusOptions?: { policyStatusId: number; name: string }[];
  canChangeStatus?: boolean;
  onStatusChange?: (statusId: number) => void;
  onConfirmTerminalStatus?: (statusId: number) => void;
  validateTerminalStatus?: (statusId: number) => TerminalStatusValidation;
  onTerminalStatusInvalid?: (statusId: number) => void;
  statusConfirmBusy?: boolean;
  adjusted: boolean;
  className?: string;
}) {
  return (
    <Card
      id="policy-information"
      className={cn(POLICY_SECTION_SCROLL_MT_CLASS, className)}
    >
      <CardHeader className="border-b">
        <CardTitle>Policy Information</CardTitle>
        <CardDescription>Summary at a glance</CardDescription>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        <dl className="flex flex-col gap-3">
          <InfoRow label="Insurer">{insurerName || "—"}</InfoRow>
          <InfoRow label="Class">Construction All Risk</InfoRow>
          <InfoRow label="Policy Number">
            <PolicyNumberField
              compact
              value={policyNumber}
              disabled={!policyNumberEditable}
              onChange={policyNumberEditable ? onPolicyNumberChange : undefined}
              onBlur={policyNumberEditable ? onPolicyNumberBlur : undefined}
              error={policyNumberError}
            />
          </InfoRow>
          <Separator />
          <InfoRow label="Status">
            {statusOptions.length > 0 && onStatusChange ? (
              <PolicyStatusMenu
                statuses={statusOptions}
                value={statusId}
                disabled={!canChangeStatus}
                onChange={onStatusChange}
                onConfirmTerminal={onConfirmTerminalStatus}
                validateTerminal={validateTerminalStatus}
                onTerminalInvalid={onTerminalStatusInvalid}
                confirmBusy={statusConfirmBusy}
              />
            ) : (
              <StatusBadge statusId={statusId} name={statusName} />
            )}
          </InfoRow>
          <InfoRow label="Adjusted">{adjusted ? "Yes" : "No"}</InfoRow>
        </dl>
      </CardContent>
    </Card>
  );
}

export function PolicyCollapsibleSection({
  id,
  title,
  description,
  open,
  onOpenChange,
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card id={id} className={cn(POLICY_SECTION_SCROLL_MT_CLASS, className)}>
        <CardHeader className="border-b p-0">
          <CollapsibleTrigger
            // Not a native <button>: Taken/view-only wraps the form in a
            // disabled fieldset, which would lock expand/collapse.
            nativeButton={false}
            render={<div />}
            className="flex w-full cursor-pointer items-start justify-between gap-3 px-(--card-spacing) pb-(--card-spacing) text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            <div className="min-w-0">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <ChevronDownIcon
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsiblePanel>
          <CardContent className="flex flex-col gap-4 pt-(--card-spacing) pb-(--card-spacing)">
            {children}
          </CardContent>
        </CollapsiblePanel>
      </Card>
    </Collapsible>
  );
}

export function PolicySectionNav({
  activeId,
  openMap,
  onNavigate,
  onToggleSection,
  invalidIssues = [],
  sectionIssueCounts = {},
  onNavigateToIssue,
  onNavigateToSectionFirstIssue,
  items = POLICY_FORM_NAV_ITEMS,
  className,
}: {
  activeId: string;
  openMap: Record<string, boolean>;
  onNavigate: (sectionId: string, opts?: { ensureOpen?: boolean }) => void;
  onToggleSection: (sectionId: string, open: boolean) => void;
  invalidIssues?: { path: string; label: string; message?: string }[];
  /** Incomplete / invalid field counts keyed by section id. */
  sectionIssueCounts?: Record<string, number>;
  onNavigateToIssue?: (path: string) => void;
  /** Focus the first incomplete/invalid field in a section. */
  onNavigateToSectionFirstIssue?: (sectionId: string) => void;
  items?: { id: string; label: string }[];
  className?: string;
}) {
  const [invalidOpen, setInvalidOpen] = useState(true);
  const [fieldQuery, setFieldQuery] = useState<string | number | "">("");
  const invalidCount = invalidIssues.length;
  const lastInvalidCountRef = useRef(invalidCount);
  const fieldOptions = useMemo(() => listPolicyFieldSearchOptions(), []);

  useEffect(() => {
    if (lastInvalidCountRef.current === invalidCount) return;
    lastInvalidCountRef.current = invalidCount;
    // Expand when issues appear; collapse/hide when cleared.
    setInvalidOpen(invalidCount > 0);
  }, [invalidCount]);

  function goToSection(sectionId: string, opts?: { ensureOpen?: boolean }) {
    onNavigate(sectionId, opts);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <nav aria-label="Policy sections">
      <Card size="sm" className={cn("gap-1 px-(--card-spacing)", className)}>
        {onNavigateToIssue ? (
          <>
            <FilterAutocomplete
              id="policy-section-field-search"
              label="Search fields and sections"
              hideLabel
              value={fieldQuery}
              onChange={(value) => {
                if (value === "" || value == null) {
                  setFieldQuery("");
                  return;
                }
                const target = String(value);
                if (target.startsWith("#")) {
                  goToSection(target.slice(1));
                } else {
                  onNavigateToIssue(target);
                }
                // Jump control — clear so the next search starts fresh.
                setFieldQuery("");
              }}
              options={fieldOptions}
              placeholder="Search…"
              emptyMessage="No matches."
              className="mb-1"
            />
            <Separator className="my-1" />
          </>
        ) : null}

        {invalidCount > 0 ? (
          <Collapsible open={invalidOpen} onOpenChange={setInvalidOpen}>
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10",
                    invalidOpen && "bg-destructive/10 font-medium",
                  )}
                />
              }
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-200",
                    invalidOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
                <span className="truncate">Incomplete</span>
              </span>
              <Badge
                variant="outline"
                className="border-destructive/40 text-[10px] text-destructive tabular-nums"
              >
                {invalidCount}
              </Badge>
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <div className="mt-1 mb-1 ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
                {invalidIssues.map((issue) => (
                  <button
                    key={issue.path}
                    type="button"
                    title={issue.message || issue.label}
                    onClick={() => {
                      onNavigateToIssue?.(issue.path);
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <span className="line-clamp-2">{issue.label}</span>
                  </button>
                ))}
              </div>
            </CollapsiblePanel>
          </Collapsible>
        ) : null}

        {invalidCount > 0 ? <Separator className="my-1" /> : null}

        {items.map((item) => {
          const active = activeId === item.id;
          const isCollapsible = item.id !== "policy-information";
          const sectionOpen = openMap[item.id] ?? true;
          const issueCount = sectionIssueCounts[item.id] ?? 0;
          const statusLabel =
            issueCount > 0
              ? `${issueCount} incomplete or invalid field${issueCount === 1 ? "" : "s"}`
              : "Section complete";
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-0.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {issueCount > 0 ? (
                <button
                  type="button"
                  title={statusLabel}
                  aria-label={`Go to first invalid field · ${statusLabel}`}
                  className={cn(
                    "ml-1.5 inline-flex h-5 min-w-4 shrink-0 items-center justify-center text-xs font-semibold tabular-nums underline-offset-2 hover:underline",
                    active ? "text-primary-foreground" : "text-destructive",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onNavigateToSectionFirstIssue?.(item.id);
                  }}
                >
                  {issueCount > 99 ? "99+" : issueCount}
                </button>
              ) : (
                <span
                  title={statusLabel}
                  aria-label={statusLabel}
                  className={cn(
                    "ml-1.5 inline-flex size-4 shrink-0 items-center justify-center",
                    active ? "text-primary-foreground" : "text-success",
                  )}
                >
                  <CheckIcon className="size-3.5" aria-hidden />
                </span>
              )}
              <a
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  goToSection(item.id);
                }}
                className="min-w-0 flex-1 truncate py-1.5 pr-2 pl-1"
              >
                {item.label}
              </a>
              {isCollapsible ? (
                <button
                  type="button"
                  className={cn(
                    "mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "text-primary-foreground hover:bg-primary-foreground/15"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-label={
                    sectionOpen
                      ? `Collapse ${item.label}`
                      : `Expand ${item.label}`
                  }
                  aria-expanded={sectionOpen}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleSection(item.id, !sectionOpen);
                    // Do not ensureOpen — navigateToSection defaults to
                    // forcing the section open and would undo the toggle.
                    goToSection(item.id, { ensureOpen: false });
                  }}
                >
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      sectionOpen ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
              ) : null}
            </div>
          );
        })}
      </Card>
    </nav>
  );
}

export function PolicyStickyHeader({
  policyNumber,
  clientId,
  clientName,
  coverTypeName,
  modeBadge,
  statusBadge,
  saveStatus,
  adjusted,
  actions,
  expandControl,
  className,
  breadcrumbs,
}: {
  policyNumber: string;
  clientId: string;
  clientName: string;
  /** Cover type label shown as a tag after the policy number. */
  coverTypeName?: string;
  /** New / Editing / View only cue — shown before status. */
  modeBadge?: ReactNode;
  statusBadge?: ReactNode;
  saveStatus?: ReactNode;
  adjusted?: boolean;
  actions?: ReactNode;
  expandControl?: ReactNode;
  className?: string;
  breadcrumbs: AppBreadcrumbItem[];
}) {
  return (
    <div
      className={cn(
        "sticky top-14 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <AppBreadcrumb items={breadcrumbs} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight md:text-xl">
                {policyNumber}
              </h2>
              {coverTypeName ? (
                <Badge variant="warning" size="default" radius="full">
                  {coverTypeName}
                </Badge>
              ) : null}
              {modeBadge}
              {statusBadge}
              {saveStatus}
              {adjusted ? (
                <Badge variant="focus-light" size="default" radius="full">
                  Adjusted
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              CAR policy for{" "}
              <Link
                to={`/clients/${clientId}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {clientName}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {expandControl}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tracks which policy section is in view. Calling the returned setter (nav
 * click) pins that section until smooth scrolling finishes, so intermediate
 * sections are not highlighted while the page scrolls past them.
 */
export function usePolicySectionScrollSpy(
  sectionIds: readonly string[],
): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");
  const pinnedUntilRef = useRef(0);
  const unlockTimerRef = useRef<number | null>(null);

  function selectSection(id: string) {
    setActiveId(id);
    // Cover typical smooth-scroll duration; scrollend clears earlier when available.
    pinnedUntilRef.current = Date.now() + 1200;
    if (unlockTimerRef.current != null) {
      window.clearTimeout(unlockTimerRef.current);
    }
    unlockTimerRef.current = window.setTimeout(() => {
      pinnedUntilRef.current = 0;
      unlockTimerRef.current = null;
    }, 1200);
  }

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const formScroll = document.querySelector<HTMLElement>(
      "[data-policy-form-scroll]",
    );
    const formIsScroller =
      Boolean(formScroll) &&
      formScroll!.scrollHeight > formScroll!.clientHeight + 1;

    /** Nearest overflow scroller (SidebarInset on mobile, form column on xl). */
    function resolveScrollRoot(): HTMLElement | null {
      if (formIsScroller && formScroll) return formScroll;
      let node: HTMLElement | null = elements[0]?.parentElement ?? null;
      while (node) {
        const { overflowY } = getComputedStyle(node);
        if (
          (overflowY === "auto" ||
            overflowY === "scroll" ||
            overflowY === "overlay") &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    const scrollRoot = resolveScrollRoot();

    function updateActiveFromScroll() {
      if (Date.now() < pinnedUntilRef.current) return;

      // Marker line just below sticky chrome (or a small gap inside the form scroller).
      const markerY = formIsScroller
        ? (formScroll?.getBoundingClientRect().top ?? 0) + 16
        : (scrollRoot?.getBoundingClientRect().top ?? 0) + 11 * 16;

      let nextId = sectionIds[0] ?? "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= markerY + 4) {
          nextId = id;
        }
      }
      if (nextId) setActiveId(nextId);
    }

    function onScrollEnd() {
      pinnedUntilRef.current = 0;
      if (unlockTimerRef.current != null) {
        window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
      updateActiveFromScroll();
    }

    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    scrollTarget.addEventListener("scroll", updateActiveFromScroll, {
      passive: true,
    });
    document.addEventListener("scrollend", onScrollEnd, true);
    updateActiveFromScroll();

    return () => {
      scrollTarget.removeEventListener("scroll", updateActiveFromScroll);
      document.removeEventListener("scrollend", onScrollEnd, true);
      if (unlockTimerRef.current != null) {
        window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
    };
  }, [sectionIds]);

  return [activeId, selectSection];
}
