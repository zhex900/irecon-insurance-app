import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
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
import { Textarea } from "~/components/ui/textarea";
import { StatusBadge } from "~/components/ui/status-badge";
import { cn } from "~/lib/utils";
import type { PolicyNote } from "~/lib/db/types";
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

/** Below app header (3.5rem) + sticky policy chrome. */
export const POLICY_STICKY_RAIL_CLASS =
  "sticky top-36 z-10 self-start max-h-[calc(100svh-9.5rem)] overflow-y-auto";

function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

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
  statusId,
  statusName,
  adjusted,
  notes = [],
  showNotes = true,
  canAddNotes = false,
  onAddNote,
  addNoteBusy = false,
  addNoteError,
}: {
  insurerName: string;
  policyNumber: string;
  statusId: number;
  statusName: string;
  adjusted: boolean;
  notes?: PolicyNote[];
  /** Hide the Policy Notes row entirely (e.g. draft policies). */
  showNotes?: boolean;
  canAddNotes?: boolean;
  onAddNote?: (description: string) => void;
  addNoteBusy?: boolean;
  addNoteError?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const wasBusyRef = useRef(false);

  useEffect(() => {
    if (wasBusyRef.current && !addNoteBusy && !addNoteError) {
      setDraft("");
      setLocalError(null);
    }
    wasBusyRef.current = addNoteBusy;
  }, [addNoteBusy, addNoteError]);

  function submitNote() {
    const text = draft.trim();
    if (!text) {
      setLocalError("Enter a note before saving.");
      return;
    }
    setLocalError(null);
    onAddNote?.(text);
  }

  return (
    <Card id="policy-information" className="scroll-mt-28">
      <CardHeader className="border-b">
        <CardTitle>Policy Information</CardTitle>
        <CardDescription>Summary at a glance</CardDescription>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        <dl className="flex flex-col gap-3">
          <InfoRow label="Insurer">{insurerName || "—"}</InfoRow>
          <InfoRow label="Class">Construction All Risk</InfoRow>
          <InfoRow label="Policy Number">{policyNumber}</InfoRow>
          <Separator />
          <InfoRow label="Status">
            <StatusBadge statusId={statusId} name={statusName} />
          </InfoRow>
          <InfoRow label="Adjusted">{adjusted ? "Yes" : "No"}</InfoRow>
          {showNotes ? (
            <>
              <Separator />
              <InfoRow label="Policy Notes">
                <div className="flex flex-col gap-3 font-normal">
                  {notes.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {notes.map((note) => (
                        <li
                          key={note.policyNoteId}
                          className="rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <p className="text-sm whitespace-pre-wrap text-foreground">
                            {note.description}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[formatNoteDate(note.createdWhen), note.createdBy]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}

                  {canAddNotes ? (
                    <div className="flex flex-col gap-2">
                      <Textarea
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          if (localError) setLocalError(null);
                        }}
                        rows={3}
                        placeholder="Add a policy note…"
                        aria-label="New policy note"
                        disabled={addNoteBusy}
                      />
                      {localError || addNoteError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {localError || addNoteError}
                        </p>
                      ) : null}
                      <div>
                        <LoadingButton
                          type="button"
                          size="sm"
                          loading={addNoteBusy}
                          loadingLabel="Saving…"
                          disabled={!draft.trim()}
                          onClick={submitNote}
                        >
                          Add note
                        </LoadingButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              </InfoRow>
            </>
          ) : null}
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
}: {
  id: string;
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card id={id} className="scroll-mt-28">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
                />
              }
            >
              <ChevronDownIcon
                className={cn(
                  "transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
          </div>
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
  invalidIssues = [],
  onNavigateToIssue,
  items = POLICY_FORM_NAV_ITEMS,
}: {
  activeId: string;
  openMap: Record<string, boolean>;
  onNavigate: (sectionId: string) => void;
  invalidIssues?: { path: string; label: string; message?: string }[];
  onNavigateToIssue?: (path: string) => void;
  items?: { id: string; label: string }[];
}) {
  const [invalidOpen, setInvalidOpen] = useState(false);
  const invalidCount = invalidIssues.length;
  const lastInvalidCountRef = useRef(invalidCount);

  useEffect(() => {
    if (lastInvalidCountRef.current === invalidCount) return;
    lastInvalidCountRef.current = invalidCount;
    if (lastInvalidCountRef.current === 0) setInvalidOpen(false);
  }, [invalidCount]);

  return (
    <nav
      aria-label="Policy sections"
      className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3"
    >
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
              <span className="truncate">Invalid fields</span>
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
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(item.id);
              document.getElementById(item.id)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className={cn(
              "rounded-lg px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span>{item.label}</span>
              {isCollapsible && !openMap[item.id] ? (
                <Badge variant="outline" className="text-[10px]">
                  Closed
                </Badge>
              ) : null}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

export function PolicyStickyHeader({
  policyNumber,
  clientId,
  clientName,
  statusBadge,
  saveStatus,
  adjusted,
  actions,
  expandControl,
}: {
  policyNumber: string;
  clientId: number;
  clientName: string;
  statusBadge?: ReactNode;
  saveStatus?: ReactNode;
  adjusted?: boolean;
  actions?: ReactNode;
  expandControl?: ReactNode;
}) {
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight md:text-xl">
              {policyNumber}
            </h2>
            {statusBadge}
            {saveStatus}
            {adjusted ? (
              <Badge className="border-border bg-muted text-foreground">
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
  );
}

export function usePolicySectionScrollSpy(
  sectionIds: readonly string[],
): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0, 0.25, 0.5],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sectionIds]);

  return [activeId, setActiveId];
}
