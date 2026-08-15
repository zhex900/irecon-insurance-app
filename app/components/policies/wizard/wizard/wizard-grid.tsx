import type { ReactNode } from "react";

export function WizardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4">
      {children}
    </div>
  );
}