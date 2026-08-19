import * as React from "react";
import { useNavigate } from "react-router";

import { submenuStartClass } from "~/components/side-nav/constants";
import { iconForRecentPath } from "~/components/side-nav/utils/icon-for-recent-path";
import { RECENT_ROW_PX } from "~/components/side-nav/utils/recents-list-height";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

export function RecentRouteRow({
  route,
  isEntering,
}: {
  route: SideNavLink;
  isEntering: boolean;
}) {
  const navigate = useNavigate();
  const routeIcon = iconForRecentPath(route.href);

  return (
    <li
      className={cn(isEntering && "recents-expand-row")}
      style={isEntering ? undefined : { height: `${RECENT_ROW_PX}px` }}
    >
      <div className="min-h-0" style={{ minHeight: `${RECENT_ROW_PX}px` }}>
        <button
          type="button"
          onClick={() => {
            void navigate(route.href);
          }}
          className={cn(
            "relative flex h-full w-full cursor-pointer items-start gap-1.5 rounded-md py-1 pe-2 text-sm text-sidebar-foreground outline-none",
            submenuStartClass,
            "hover:bg-sidebar-accent hover:text-primary",
            "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          )}
        >
          {React.createElement(routeIcon, {
            className: "mt-0.5 size-4 shrink-0",
            "aria-hidden": true,
          })}
          <span className="max-w-44 min-w-0 flex-1 truncate text-start">
            <span className="block truncate">{route.label}</span>
            <span className="block truncate text-xs font-normal text-sidebar-foreground/55">
              {route.caption}
            </span>
          </span>
        </button>
      </div>
    </li>
  );
}
