import { ChevronRightIcon, ClockIcon } from "lucide-react";
import * as React from "react";

import { submenuStartClass } from "~/components/side-nav/constants";
import { NavRowButton } from "~/components/side-nav/nav-row-button";
import { RecentRouteRow } from "~/components/side-nav/recent-route-row";
import { recentsListHeightPx } from "~/components/side-nav/utils/recents-list-height";
import { excludeRecentRoute } from "~/lib/services/navigation/recent-routes";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

export function RecentsSection({
  recentRoutes,
  currentPathname,
  enteringId,
  spilledRoute,
  open,
  iconRail,
  onToggle,
}: {
  recentRoutes: SideNavLink[];
  currentPathname: string;
  enteringId: string | null;
  /** Bottom row kept mounted during insert so the list does not jump. */
  spilledRoute: SideNavLink | null;
  open: boolean;
  iconRail: boolean;
  onToggle: () => void;
}) {
  const visibleRoutes = React.useMemo(
    () => excludeRecentRoute(recentRoutes, currentPathname),
    [recentRoutes, currentPathname],
  );

  const displayRoutes = React.useMemo(() => {
    if (!spilledRoute || !enteringId) return visibleRoutes;
    if (visibleRoutes.some((route) => route.id === spilledRoute.id)) {
      return visibleRoutes;
    }
    return [...visibleRoutes, spilledRoute];
  }, [visibleRoutes, spilledRoute, enteringId]);

  // Height follows the committed stack (excludes spilled) so unmounting the
  // spilled row after the insert animation does not change the box height.
  const listHeightPx = recentsListHeightPx(visibleRoutes);
  const listOpen = open && !iconRail;

  return (
    <div className="mb-0.5 [--side-nav-indent:16px]">
      <NavRowButton
        icon={ClockIcon}
        label="Recents"
        iconRail={iconRail}
        aria-expanded={listOpen}
        onClick={onToggle}
        trailing={
          iconRail ? null : (
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 text-sidebar-foreground/70",
                listOpen && "rotate-90",
              )}
            />
          )
        }
      />

      {listOpen ? (
        <div className="min-h-0 overflow-hidden">
          <div
            className="overflow-hidden transition-[height] duration-300 ease-out"
            style={{ height: `${listHeightPx}px` }}
          >
            {displayRoutes.length === 0 ? (
              <p
                className={cn(
                  "py-1.5 pe-2 text-xs text-sidebar-foreground/55",
                  submenuStartClass,
                )}
              >
                No recent pages
              </p>
            ) : (
              <ul className="flex flex-col">
                {displayRoutes.map((route) => (
                  <RecentRouteRow
                    key={route.id}
                    route={route}
                    isEntering={enteringId === route.id}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
