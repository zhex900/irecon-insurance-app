import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export function FormulaTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        // Not a native <button>: Taken/view-only wraps premium in a disabled
        // fieldset, which would block the formula "i" control.
        render={<span />}
        className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
        aria-label={label}
      >
        i
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-80 text-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
