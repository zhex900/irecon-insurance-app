import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  LayoutDashboardIcon,
  UsersIcon,
  FileTextIcon,
  BarChart3Icon,
  SettingsIcon,
  FileBarChart2Icon,
  RefreshCwIcon,
  UserCogIcon,
  MailIcon,
  FileStackIcon,
  FilePenLineIcon,
  SlidersHorizontalIcon,
  ScrollTextIcon,
  BadgeDollarSignIcon,
  ChevronRightIcon,
  ClockIcon,
  type LucideIcon,
} from "lucide-react";
import { useSidebar } from "~/components/ui/sidebar";
import {
  normalizeRecentPath,
  pushRecentRouteLocalDetailed,
  recentIdForPath,
} from "~/lib/services/navigation/recent-routes";
import {
  sectionFromPathname,
  type NavSectionId,
} from "~/lib/services/navigation/sidebar-state";
import type {
  SideNavData,
  SideNavLink,
} from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

type SectionId = NavSectionId;

const CHILD_ICONS: Record<string, LucideIcon> = {
  "report-car-policies": FileBarChart2Icon,
  "report-car-renewals": RefreshCwIcon,
  "settings-users": UserCogIcon,
  "settings-ar-brokers": UsersIcon,
  "settings-email-templates": MailIcon,
  "settings-library-documents": FileStackIcon,
  "settings-document-templates": FilePenLineIcon,
  "settings-features": SlidersHorizontalIcon,
  "settings-audit-log": ScrollTextIcon,
  "settings-prices": BadgeDollarSignIcon,
};

const TOP_LINKS: {
  id: string;
  to: string;
  label: string;
  icon: LucideIcon;
  section?: SectionId;
}[] = [
  {
    id: "dashboard",
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
  },
  { id: "clients", to: "/clients", label: "Clients", icon: UsersIcon },
  { id: "policies", to: "/policies", label: "Policies", icon: FileTextIcon },
  {
    id: "reports",
    to: "/reports",
    label: "Reports",
    icon: BarChart3Icon,
    section: "reports",
  },
  {
    id: "settings",
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    section: "settings",
  },
];

/** Matches tree level-1: TreeItem `ps-(--tree-padding)` + label `px-2`. */
const submenuStartClass = "ps-[calc(0.5rem+var(--side-nav-indent,16px))]";

const navRowClass =
  "relative flex h-8 w-max cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring";

const navRowActiveClass =
  "bg-sidebar-accent font-medium text-primary before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar-accent";

function pathMatches(pathname: string, href: string, end = false): boolean {
  if (end || href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Same icon as the matching top-level / settings / reports menu item. */
function iconForRecentPath(path: string): LucideIcon {
  const byExactChild: Record<string, LucideIcon> = {
    "/reports/car-policies": CHILD_ICONS["report-car-policies"] ?? FileTextIcon,
    "/reports/car-renewals":
      CHILD_ICONS["report-car-renewals"] ?? RefreshCwIcon,
    "/settings/users": CHILD_ICONS["settings-users"] ?? UserCogIcon,
    "/settings/ar-brokers": CHILD_ICONS["settings-ar-brokers"] ?? UsersIcon,
    "/settings/email-templates":
      CHILD_ICONS["settings-email-templates"] ?? MailIcon,
    "/settings/library-documents":
      CHILD_ICONS["settings-library-documents"] ?? FileStackIcon,
    "/settings/document-templates":
      CHILD_ICONS["settings-document-templates"] ?? FilePenLineIcon,
    "/settings/features":
      CHILD_ICONS["settings-features"] ?? SlidersHorizontalIcon,
    "/settings/audit-log": CHILD_ICONS["settings-audit-log"] ?? ScrollTextIcon,
    "/settings/prices": CHILD_ICONS["settings-prices"] ?? BadgeDollarSignIcon,
  };

  if (byExactChild[path]) return byExactChild[path];

  // Nested settings pages (e.g. email template editor) use the parent icon.
  if (path.startsWith("/settings/email-templates/")) {
    return CHILD_ICONS["settings-email-templates"] ?? MailIcon;
  }
  if (path.startsWith("/settings/document-templates/")) {
    return CHILD_ICONS["settings-document-templates"] ?? FilePenLineIcon;
  }
  if (path.startsWith("/settings/prices/")) {
    return CHILD_ICONS["settings-prices"] ?? BadgeDollarSignIcon;
  }

  for (const link of TOP_LINKS) {
    if (pathMatches(path, link.to, link.to === "/dashboard")) {
      return link.icon;
    }
  }

  return FileTextIcon;
}

const RECENTS_ENTER_MS = 320;
/** Single-line recent (no caption). */
const RECENT_ROW_PLAIN_PX = 32;
/** Recent with caption under the label (client/policy/template). */
const RECENT_ROW_CAPTION_PX = 48;
/** Empty-state line when there are no recents. */
const RECENT_EMPTY_PX = 32;

function recentRowHeightPx(route: SideNavLink): number {
  return route.caption ? RECENT_ROW_CAPTION_PX : RECENT_ROW_PLAIN_PX;
}

function recentsListHeightPx(routes: SideNavLink[]): number {
  if (routes.length === 0) return RECENT_EMPTY_PX;
  return routes.reduce((sum, route) => sum + recentRowHeightPx(route), 0);
}

/** New top row expands (0→full) inside the Recents list box. */
function RecentRouteRow({
  route,
  isEntering,
}: {
  route: SideNavLink;
  isEntering: boolean;
}) {
  const navigate = useNavigate();
  const routeIcon = iconForRecentPath(route.href);
  const rowHeightPx = recentRowHeightPx(route);

  return (
    <li
      className={cn(isEntering && "recents-expand-row")}
      style={isEntering ? undefined : { height: `${rowHeightPx}px` }}
    >
      <div className="min-h-0" style={{ minHeight: `${rowHeightPx}px` }}>
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
            {route.caption ? (
              <span className="block truncate text-xs font-normal text-sidebar-foreground/55">
                {route.caption}
              </span>
            ) : null}
          </span>
        </button>
      </div>
    </li>
  );
}

function RecentsSection({
  recentRoutes,
  enteringId,
  spilledRoute,
  open,
  iconRail,
  onToggle,
}: {
  recentRoutes: SideNavLink[];
  enteringId: string | null;
  /** Dropped bottom row kept mounted during insert so the list does not jump up. */
  spilledRoute: SideNavLink | null;
  open: boolean;
  /** Narrow icon rail — same button, icon-only chrome (avoids tree-swap click loss). */
  iconRail: boolean;
  onToggle: () => void;
}) {
  const displayRoutes = React.useMemo(() => {
    if (!spilledRoute || !enteringId) return recentRoutes;
    if (recentRoutes.some((route) => route.id === spilledRoute.id)) {
      return recentRoutes;
    }
    return [...recentRoutes, spilledRoute];
  }, [recentRoutes, spilledRoute, enteringId]);

  // Use the committed stack (excludes spilled) so unmounting the spilled row
  // after the insert animation does not change the box height.
  const listHeightPx = recentsListHeightPx(recentRoutes);
  const listOpen = open && !iconRail;

  return (
    <div className="mb-0.5 [--side-nav-indent:16px]">
      <button
        type="button"
        onClick={onToggle}
        title={iconRail ? "Recents" : undefined}
        aria-label={iconRail ? "Recents" : undefined}
        className={cn(
          // Match TreeItemLabel / SidebarMenuButton icon column (px-2, gap-1.5, h-8).
          "relative flex h-8 w-max cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground outline-none",
          "hover:bg-sidebar-accent hover:text-primary",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          // Icon rail: same box as SidebarMenuButton `size-8 p-2`.
          iconRail && "size-8 gap-0 overflow-hidden p-2",
        )}
        aria-expanded={listOpen}
      >
        <ClockIcon className="size-4 shrink-0" />
        <span
          className={cn("text-start whitespace-nowrap", iconRail && "sr-only")}
        >
          Recents
        </span>
        {iconRail ? null : (
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-sidebar-foreground/70",
              listOpen && "rotate-90",
            )}
          />
        )}
      </button>

      {listOpen ? (
        <div className="min-h-0 overflow-hidden">
          <div
            className="overflow-hidden"
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

/** Plain React nav — same SSR/hydration model as RecentsSection (no headless-tree). */
function MainNavSection({
  data,
  pathname,
  iconRail,
  expandedSections,
  onToggleSection,
}: {
  data: SideNavData;
  pathname: string;
  iconRail: boolean;
  /** Cookie-backed, controlled from AppLayout. */
  expandedSections: SectionId[];
  onToggleSection: (section: SectionId) => void;
}) {
  const navigate = useNavigate();
  const { setOpen } = useSidebar();

  return (
    <div className="[--side-nav-indent:16px]">
      <ul className="flex w-max flex-col">
        {TOP_LINKS.map((link) => {
          const Icon = link.icon;
          const isSection = Boolean(link.section);

          if (!isSection) {
            const isActive = pathMatches(
              pathname,
              link.to,
              link.to === "/dashboard",
            );
            return (
              <li key={link.id}>
                <button
                  type="button"
                  title={iconRail ? link.label : undefined}
                  aria-label={iconRail ? link.label : undefined}
                  onClick={() => {
                    void navigate(link.to);
                  }}
                  className={cn(
                    navRowClass,
                    "before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar",
                    iconRail && "size-8 gap-0 overflow-hidden p-2",
                    isActive && navRowActiveClass,
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      "text-start whitespace-nowrap",
                      iconRail && "sr-only",
                    )}
                  >
                    {link.label}
                  </span>
                </button>
              </li>
            );
          }

          const section = link.section!;
          const children = section === "reports" ? data.reports : data.settings;
          // No leaves → hide the section root (e.g. Settings for brokers).
          if (children.length === 0) return null;

          const sectionOpen = expandedSections.includes(section) && !iconRail;
          const isSectionActive = sectionFromPathname(pathname) === section;

          return (
            <li key={link.id}>
              <button
                type="button"
                title={iconRail ? link.label : undefined}
                aria-label={iconRail ? link.label : undefined}
                onClick={() => {
                  if (iconRail) {
                    setOpen(true);
                    if (!expandedSections.includes(section)) {
                      onToggleSection(section);
                    }
                    void navigate(link.to);
                    return;
                  }
                  onToggleSection(section);
                }}
                aria-expanded={sectionOpen}
                className={cn(
                  navRowClass,
                  "before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar",
                  iconRail && "size-8 gap-0 overflow-hidden p-2",
                  isSectionActive && navRowActiveClass,
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span
                  className={cn(
                    "text-start whitespace-nowrap",
                    iconRail && "sr-only",
                  )}
                >
                  {link.label}
                </span>
                {iconRail ? null : (
                  <ChevronRightIcon
                    className={cn(
                      "size-3.5 shrink-0 text-sidebar-foreground/70",
                      sectionOpen && "rotate-90",
                    )}
                  />
                )}
              </button>

              {sectionOpen ? (
                <ul className="flex flex-col">
                  {children.map((child) => {
                    const ChildIcon = CHILD_ICONS[child.id] ?? FileTextIcon;
                    const isActive = pathMatches(pathname, child.href);
                    return (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void navigate(child.href);
                          }}
                          className={cn(
                            navRowClass,
                            "h-8 w-full before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar",
                            submenuStartClass,
                            isActive && navRowActiveClass,
                          )}
                        >
                          <ChildIcon className="size-4 shrink-0" />
                          <span className="text-start whitespace-nowrap">
                            {child.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
  const lastRecordedPathRef = React.useRef("");
  const recentRoutesRef = React.useRef(data.recentRoutes);
  const skipInitialPathEffectRef = React.useRef(true);
  const enterClearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const recordAbortRef = React.useRef<AbortController | null>(null);

  const [recentRoutes, setRecentRoutes] = React.useState(data.recentRoutes);
  const [enteringId, setEnteringId] = React.useState<string | null>(null);
  const [spilledRoute, setSpilledRoute] = React.useState<SideNavLink | null>(
    null,
  );

  function toggleRecentsSection() {
    if (!showExpandedNav) {
      onRecentsOpenChange(true);
      setOpen(true);
      return;
    }
    onRecentsOpenChange(!recentsOpen);
  }

  function toggleNavSection(section: SectionId) {
    const next = navSectionsExpanded.includes(section)
      ? navSectionsExpanded.filter((id) => id !== section)
      : [...navSectionsExpanded, section];
    onNavSectionsChange(next);
  }

  // Auto-expand the active section on navigation only — not when the user
  // manually collapses Reports/Settings while staying on that section.
  React.useEffect(() => {
    const active = sectionFromPathname(location.pathname);
    if (!active || navSectionsExpanded.includes(active)) return;
    onNavSectionsChange([...navSectionsExpanded, active]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname-driven only
  }, [location.pathname]);

  React.useEffect(() => {
    recentRoutesRef.current = recentRoutes;
  }, [recentRoutes]);

  React.useEffect(
    () => () => {
      if (enterClearTimerRef.current !== null) {
        clearTimeout(enterClearTimerRef.current);
      }
      recordAbortRef.current?.abort();
    },
    [],
  );

  React.useEffect(() => {
    const path = normalizeRecentPath(location.pathname);
    if (!path) return;

    // Hard refresh: trust the layout loader; do not reorder, animate, or POST.
    if (skipInitialPathEffectRef.current) {
      skipInitialPathEffectRef.current = false;
      lastRecordedPathRef.current = path;
      return;
    }

    if (lastRecordedPathRef.current === path) return;
    lastRecordedPathRef.current = path;

    const { routes, spilled } = pushRecentRouteLocalDetailed(
      recentRoutesRef.current,
      path,
    );
    setRecentRoutes(routes);
    setSpilledRoute(spilled);
    setEnteringId(recentIdForPath(path));
    if (enterClearTimerRef.current !== null) {
      clearTimeout(enterClearTimerRef.current);
    }
    enterClearTimerRef.current = setTimeout(() => {
      setEnteringId(null);
      setSpilledRoute(null);
      enterClearTimerRef.current = null;
    }, RECENTS_ENTER_MS + 40);

    // Use fetch (not useFetcher) so recording a recent does not revalidate
    // the active page loaders — that was remounting/flickering the side nav
    // on heavy routes like Settings → Prices.
    recordAbortRef.current?.abort();
    const abort = new AbortController();
    recordAbortRef.current = abort;
    const formData = new FormData();
    formData.set("path", path);
    void fetch("/api/recent-routes", {
      method: "POST",
      body: formData,
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          routes?: SideNavLink[];
        };
        const apiRoutes = payload.routes;
        if (!apiRoutes?.length) return;
        if (abort.signal.aborted) return;
        if (lastRecordedPathRef.current !== path) return;
        if (apiRoutes[0]?.href !== path) return;
        setRecentRoutes(apiRoutes);
      })
      .catch(() => {
        // Ignore abort / network errors; optimistic list already updated.
      });
  }, [location.pathname]);

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
          iconRail={!showExpandedNav}
          onToggle={toggleRecentsSection}
        />
      </nav>
      <nav
        aria-label="Main"
        className={cn("w-max", showExpandedNav ? "px-1" : undefined)}
      >
        <MainNavSection
          data={data}
          pathname={location.pathname}
          iconRail={!showExpandedNav}
          expandedSections={navSectionsExpanded}
          onToggleSection={toggleNavSection}
        />
      </nav>
    </>
  );
});
