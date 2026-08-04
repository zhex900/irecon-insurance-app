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
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem, TreeItemLabel } from "~/components/reui/tree";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  normalizeRecentPath,
  pushRecentRouteLocalDetailed,
  recentIdForPath,
} from "~/lib/services/navigation/recent-routes";
import type {
  SideNavData,
  SideNavLink,
} from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

type SectionId = "reports" | "settings";

type NavItem = {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: string[];
};

const RECENTS_OPEN_KEY = "irecon.side-nav.recents-open";
const RECENTS_OPEN_EVENT = "irecon-side-nav-recents-open";

function readRecentsOpen(): boolean {
  try {
    return sessionStorage.getItem(RECENTS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRecentsOpen(open: boolean) {
  try {
    sessionStorage.setItem(RECENTS_OPEN_KEY, open ? "1" : "0");
    window.dispatchEvent(new Event(RECENTS_OPEN_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

function subscribeRecentsOpen(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(RECENTS_OPEN_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(RECENTS_OPEN_EVENT, onStoreChange);
  };
}

const CHILD_ICONS: Record<string, LucideIcon> = {
  "report-clients": UsersIcon,
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

const indent = 16;
/** Matches tree level-1: TreeItem `ps-(--tree-padding)` + label `px-2`. */
const submenuStartClass = "ps-[calc(0.5rem+var(--side-nav-indent,16px))]";

function sectionFromPath(pathname: string): SectionId | null {
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings";
  }
  return null;
}

function pathMatches(pathname: string, href: string, end = false): boolean {
  if (end || href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Same icon as the matching top-level / settings / reports menu item. */
function iconForRecentPath(path: string): LucideIcon {
  const byExactChild: Record<string, LucideIcon> = {
    "/reports/clients": CHILD_ICONS["report-clients"] ?? UsersIcon,
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

function buildNavItems(data: SideNavData): Record<string, NavItem> {
  const items: Record<string, NavItem> = {
    root: {
      name: "Navigation",
      children: TOP_LINKS.map((link) => link.id),
    },
  };

  for (const link of TOP_LINKS) {
    if (link.section === "reports") {
      items[link.id] = {
        name: link.label,
        href: link.to,
        icon: link.icon,
        children: data.reports.map((child) => child.id),
      };
      for (const child of data.reports) {
        items[child.id] = {
          name: child.label,
          href: child.href,
          icon: CHILD_ICONS[child.id] ?? FileTextIcon,
        };
      }
      continue;
    }

    if (link.section === "settings") {
      items[link.id] = {
        name: link.label,
        href: link.to,
        icon: link.icon,
        children: data.settings.map((child) => child.id),
      };
      for (const child of data.settings) {
        items[child.id] = {
          name: child.label,
          href: child.href,
          icon: CHILD_ICONS[child.id] ?? FileTextIcon,
        };
      }
      continue;
    }

    items[link.id] = {
      name: link.label,
      href: link.to,
      icon: link.icon,
    };
  }

  return items;
}

function collectActiveIds(
  pathname: string,
  items: Record<string, NavItem>,
): string[] {
  const active = new Set<string>();
  let bestLeaf: { id: string; href: string } | null = null;

  for (const [id, item] of Object.entries(items)) {
    if (id === "root") continue;
    if (!item.href) continue;
    const isFolder = (item.children?.length ?? 0) > 0;
    if (isFolder) continue;
    if (!pathMatches(pathname, item.href)) continue;
    if (!bestLeaf || item.href.length > bestLeaf.href.length) {
      bestLeaf = { id, href: item.href };
    }
  }

  if (bestLeaf) {
    active.add(bestLeaf.id);
  }

  const section = sectionFromPath(pathname);
  if (section) {
    active.add(section);
  }

  if (!bestLeaf && !section) {
    for (const link of TOP_LINKS) {
      if (link.section) continue;
      if (pathMatches(pathname, link.to, link.to === "/dashboard")) {
        active.add(link.id);
      }
    }
  }

  return [...active];
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
      style={isEntering ? undefined : { height: rowHeightPx }}
    >
      <div className="min-h-0" style={{ minHeight: rowHeightPx }}>
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
    <div
      className="mb-0.5"
      style={
        {
          ["--side-nav-indent" as string]: `${indent}px`,
        } as React.CSSProperties
      }
    >
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
              "size-3.5 shrink-0 text-sidebar-foreground/70 transition-transform duration-200",
              listOpen && "rotate-90",
            )}
          />
        )}
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          listOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="overflow-hidden" style={{ height: listHeightPx }}>
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
      </div>
    </div>
  );
}

function CollapsedSideNav({ pathname }: { pathname: string }) {
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      {TOP_LINKS.map((item) => {
        const Icon = item.icon;
        const isActive = item.section
          ? sectionFromPath(pathname) === item.section
          : pathMatches(pathname, item.to, item.to === "/dashboard");
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              tooltip={item.label}
              isActive={isActive}
              aria-label={item.label}
              className="cursor-pointer"
              onClick={() => {
                void navigate(item.to);
              }}
            >
              <Icon />
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function SideNavTree({
  data,
  pathname,
}: {
  data: SideNavData;
  pathname: string;
}) {
  const navigate = useNavigate();
  const items = React.useMemo(() => buildNavItems(data), [data]);
  const activeIds = React.useMemo(
    () => collectActiveIds(pathname, items),
    [pathname, items],
  );
  const activeSection = sectionFromPath(pathname);

  const [expandedItems, setExpandedItems] = React.useState<string[]>(() =>
    activeSection ? [activeSection] : [],
  );
  const [lastActiveSection, setLastActiveSection] =
    React.useState(activeSection);

  // Keep the active section open when moving between its pages.
  if (activeSection !== lastActiveSection) {
    setLastActiveSection(activeSection);
    if (activeSection && !expandedItems.includes(activeSection)) {
      setExpandedItems([...expandedItems, activeSection]);
    }
  }

  const tree = useTree<NavItem>({
    state: { expandedItems },
    setExpandedItems,
    indent,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    onPrimaryAction: (item) => {
      const href = item.getItemData().href;
      if (!href) return;
      if (item.isFolder()) {
        // Clicking an open section should only collapse — navigating would
        // change the route and the active-section sync would re-expand it.
        if (item.isExpanded()) return;
        if (!pathMatches(pathname, href)) {
          void navigate(href);
        }
        return;
      }
      void navigate(href);
    },
    dataLoader: {
      getItem: (itemId) => items[itemId],
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <Tree
      indent={indent}
      tree={tree}
      toggleIconType="chevron"
      className="w-max"
    >
      {tree.getItems().map((item) => {
        const navItem = item.getItemData();
        const isFolder = item.isFolder();
        const isActive = activeIds.includes(item.getId());
        const Icon = navItem.icon;

        return (
          <TreeItem
            key={item.getId()}
            item={item}
            type="button"
            data-active={isActive || undefined}
            className="cursor-pointer"
          >
            <TreeItemLabel
              showToggleIcon={false}
              className={cn(
                "relative w-max cursor-pointer gap-1.5 text-sidebar-foreground before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md",
                "hover:bg-sidebar-accent hover:text-primary hover:before:bg-sidebar-accent",
                "in-focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent font-medium text-primary before:bg-sidebar-accent"
                  : "bg-transparent before:bg-sidebar",
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className="text-start whitespace-nowrap">
                {navItem.name}
              </span>
              {isFolder ? (
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 shrink-0 text-sidebar-foreground/70 transition-transform duration-200",
                    item.isExpanded() && "rotate-90",
                  )}
                />
              ) : null}
            </TreeItemLabel>
          </TreeItem>
        );
      })}
    </Tree>
  );
}

export function AppSideNav({ data }: { data: SideNavData }) {
  const location = useLocation();
  const { open, isMobile, setOpen } = useSidebar();
  const showExpandedNav = open || isMobile;
  const lastRecordedPathRef = React.useRef("");
  const recentRoutesRef = React.useRef(data.recentRoutes);
  const enterClearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const recordAbortRef = React.useRef<AbortController | null>(null);

  const loaderRoutesKey = data.recentRoutes
    .map((r) => `${r.href}:${r.label}:${r.caption ?? ""}`)
    .join("|");
  const [loaderKey, setLoaderKey] = React.useState(loaderRoutesKey);
  const [recentRoutes, setRecentRoutes] = React.useState(data.recentRoutes);
  const [enteringId, setEnteringId] = React.useState<string | null>(null);
  const [spilledRoute, setSpilledRoute] = React.useState<SideNavLink | null>(
    null,
  );
  const recentsOpen = React.useSyncExternalStore(
    subscribeRecentsOpen,
    readRecentsOpen,
    () => false,
  );

  function handleRecentsOpenChange(next: boolean) {
    writeRecentsOpen(next);
  }

  function toggleRecentsSection() {
    // Icon rail: pin the sidebar open and expand Recents in one click.
    if (!showExpandedNav) {
      handleRecentsOpenChange(true);
      setOpen(true);
      return;
    }
    handleRecentsOpenChange(!recentsOpen);
  }

  React.useEffect(() => {
    recentRoutesRef.current = recentRoutes;
  }, [recentRoutes]);

  if (loaderRoutesKey !== loaderKey) {
    setLoaderKey(loaderRoutesKey);
    setRecentRoutes(data.recentRoutes);
    setSpilledRoute(null);
  }

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
      {/* One Recents control always. Expanded: same `px-1` as the main tree.
          Icon rail: no extra pad so the clock lines up with CollapsedSideNav. */}
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
      <div
        className={cn(!showExpandedNav && "hidden")}
        // Keep mounted while icon-rail; only hide so hover expand does not remount.
        inert={!showExpandedNav ? true : undefined}
      >
        <nav aria-label="Main" className="w-max px-1">
          <SideNavTree data={data} pathname={location.pathname} />
        </nav>
      </div>
      <div
        className={cn(showExpandedNav && "hidden")}
        inert={showExpandedNav ? true : undefined}
      >
        <CollapsedSideNav pathname={location.pathname} />
      </div>
    </>
  );
}
