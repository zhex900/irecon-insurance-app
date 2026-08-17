import type { ReactNode } from "react";

import { POLICY_STICKY_RAIL_CLASS } from "~/components/policies/policy-form-layout";
import { cn } from "~/lib/utils";

export function PremiumAside({ children }: { children: ReactNode }) {
  return (
    <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
      {children}
    </aside>
  );
}
