import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { POLICY_STICKY_RAIL_CLASS } from "~/components/policies/policy-form-layout";

export function PremiumAside({ children }: { children: ReactNode }) {
  return (
    <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
      {children}
    </aside>
  );
}
