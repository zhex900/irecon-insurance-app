import { useEffect, useRef } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export type MobileSectionNavProps = {
  items: { id: string; label: string }[];
  activeSectionId: string;
  onNavigate: (id: string) => void;
  sectionIssueCounts?: Record<string, number>;
  onNavigateToSectionFirstIssue?: (sectionId: string) => void;
};

export function MobileSectionNav({
  items,
  activeSectionId,
  onNavigate,
  sectionIssueCounts = {},
  onNavigateToSectionFirstIssue,
}: MobileSectionNavProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active tag visible in the horizontal strip as scroll-spy updates.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const active = scroller.querySelector<HTMLElement>(
      `[data-section-nav-id="${CSS.escape(activeSectionId)}"]`,
    );
    if (!active) return;
    const left =
      active.offsetLeft - scroller.clientWidth / 2 + active.offsetWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeSectionId]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {items.map((item) => {
        const active = activeSectionId === item.id;
        const issueCount = sectionIssueCounts[item.id] ?? 0;
        const statusLabel =
          issueCount > 0
            ? `${issueCount} incomplete or invalid field${issueCount === 1 ? "" : "s"}`
            : "Section complete";

        return (
          <div
            key={item.id}
            data-section-nav-id={item.id}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs",
              active
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {issueCount > 0 ? (
              <button
                type="button"
                title={statusLabel}
                aria-label={`Go to first invalid field · ${statusLabel}`}
                className={cn(
                  "inline-flex h-4 min-w-3.5 items-center justify-center text-[11px] font-semibold tabular-nums underline-offset-2 hover:underline",
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
                  "inline-flex size-3.5 items-center justify-center",
                  active ? "text-primary-foreground" : "text-success",
                )}
              >
                <CheckIcon className="size-3" aria-hidden />
              </span>
            )}
            <a
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.id);
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="truncate pr-1"
            >
              {item.label}
            </a>
          </div>
        );
      })}
    </div>
  );
}