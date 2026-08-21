import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { PolicyPhase } from "../shared/policy-phase";
import { isEditablePhase } from "../shared/policy-phase";

export function WizardContainer({
  children,
  phase,
  className,
}: {
  children: ReactNode;
  phase: PolicyPhase;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 -mt-4 flex flex-col gap-4 md:-mx-8 md:-mt-8",
        "xl:-mb-4 xl:h-[calc(100svh-3.5rem)] xl:min-h-0 xl:overflow-hidden md:xl:-mb-8",
        "[&_[data-slot=card]]:overflow-x-hidden",
        !isEditablePhase(phase) &&
          "[&_[data-slot=card]]:bg-muted/40 [&_input]:bg-muted/30 [&_select]:bg-muted/30 [&_textarea]:bg-muted/30",
        className,
      )}
      data-policy-phase={phase}
    >
      {children}
    </div>
  );
}
