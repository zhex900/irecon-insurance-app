import * as React from "react";
import { useLocation } from "react-router";

import { AppNavSection } from "~/components/side-nav/app-nav-section";
import type { SectionId } from "~/components/side-nav/constants";
import { useNavSections } from "~/components/side-nav/hooks/use-nav-sections";
import { useRecentRoutes } from "~/components/side-nav/hooks/use-recent-routes";
import { RecentsSection } from "~/components/side-nav/recents-section";
import { useSidebar } from "~/components/ui/sidebar";
import type { SideNavData } from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

export const AppSideNav = React.memo(function AppSideNav({
  data,
  recentsOpen,
  sidebarExpanded,
  navSectionsExpanded,
  onRecentsOpenChange,
  onNavSectionsChange,
}: {
  data: SideNavData;
  recentsOpen: boolean;
  sidebarExpanded: boolean;
  navSectionsExpanded: SectionId[];
  onRecentsOpenChange: (open: boolean) => void;
  onNavSectionsChange: (sections: SectionId[]) => void;
}) {
  const location = useLocation();
  const { isMobile, setOpen } = useSidebar();
  const showExpandedNav = sidebarExpanded || isMobile;
  const iconRail = !showExpandedNav;

  const { recentRoutes, enteringId, spilledRoute } = useRecentRoutes(
    data.recentRoutes,
    location.pathname,
  );
  const { expandedSections, toggleNavSection } = useNavSections(
    navSectionsExpanded,
    onNavSectionsChange,
  );

  function toggleRecentsSection() {
    if (!showExpandedNav) {
      onRecentsOpenChange(true);
      setOpen(true);
      return;
    }
    onRecentsOpenChange(!recentsOpen);
  }

  return (
    <>
      <nav
        aria-label="Recents"
        className={cn(showExpandedNav ? "px-1" : undefined)}
      >
        <RecentsSection
          recentRoutes={recentRoutes}
          enteringId={enteringId}
          spilledRoute={spilledRoute}
          open={recentsOpen}
          iconRail={iconRail}
          onToggle={toggleRecentsSection}
        />
      </nav>
      <nav
        aria-label="App"
        className={cn("w-max", showExpandedNav ? "px-1" : undefined)}
      >
        <AppNavSection
          data={data}
          pathname={location.pathname}
          iconRail={iconRail}
          expandedSections={expandedSections}
          onToggleSection={toggleNavSection}
        />
      </nav>
    </>
  );
});
