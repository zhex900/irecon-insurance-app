import type { LucideIcon } from "lucide-react";
import * as React from "react";

import {
  navRowActiveClass,
  navRowClass,
  submenuStartClass,
} from "~/components/side-nav/constants";
import { cn } from "~/lib/utils";

export function NavRowButton({
  icon: Icon,
  label,
  iconRail = false,
  isActive = false,
  variant = "default",
  onClick,
  trailing,
  "aria-expanded": ariaExpanded,
}: {
  icon: LucideIcon;
  label: string;
  iconRail?: boolean;
  isActive?: boolean;
  variant?: "default" | "submenu";
  onClick: () => void;
  trailing?: React.ReactNode;
  "aria-expanded"?: boolean;
}) {
  const isSubmenu = variant === "submenu";

  return (
    <button
      type="button"
      onClick={onClick}
      title={iconRail ? label : undefined}
      aria-label={iconRail ? label : undefined}
      aria-expanded={ariaExpanded}
      className={cn(
        navRowClass,
        isSubmenu
          ? "h-8 w-full before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar"
          : "before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar",
        isSubmenu && submenuStartClass,
        !isSubmenu && iconRail && "size-8 gap-0 overflow-hidden p-2",
        isActive && navRowActiveClass,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span
        className={cn(
          "text-start whitespace-nowrap",
          !isSubmenu && iconRail && "sr-only",
        )}
      >
        {label}
      </span>
      {trailing}
    </button>
  );
}
