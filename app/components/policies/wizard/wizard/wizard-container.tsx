import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { useMode } from "../hooks/utils/use-mode";

export function WizardContainer({ children }: { children: ReactNode }) {
  const { wizardMode } = useMode();

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
      )}
      data-wizard-mode={wizardMode}
    >
      {children}
    </div>
  );
}
