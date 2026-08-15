import type { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  return (
    <div
      data-policy-form-scroll
      className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0"
    >
      {children}
    </div>
  );
}