import * as React from "react";
import {
  Link,
  NavLink,
  useFetcher,
  useLocation,
  useNavigate,
} from "react-router";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
  } catch {
    // ignore quota / private mode
  }
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
/** Single-line recent (no Client/Policy caption). */
const RECENT_ROW_PLAIN_PX = 32;
/** Client / policy recent with caption under the label. */
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
  const routeIcon = iconForRecentPath(route.href);
  const rowHeightPx = recentRowHeightPx(route);

  return (
    <li
      className={cn(isEntering && "recents-expand-row")}
      style={isEntering ? undefined : { height: rowHeightPx }}
    >
      <div className="min-h-0" style={{ minHeight: rowHeightPx }}>
        <Link
          to={route.href}
          prefetch="intent"
          className={cn(
            "relative flex h-full w-full items-start gap-1.5 rounded-md py-1 pe-2 text-sm text-sidebar-foreground outline-none",
            submenuStartClass,
            "hover:bg-sidebar-accent hover:text-primary",
            "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          )}
        >
          {React.createElement(routeIcon, {
            className: "mt-0.5 size-4 shrink-0",
            "aria-hidden": true,
          })}
          <span className="min-w-0 flex-1 truncate text-start">
            <span className="block truncate">{route.label}</span>
            {route.caption ? (
              <span className="block truncate text-xs font-normal text-sidebar-foreground/55">
                {route.caption}
              </span>
            ) : null}
          </span>
        </Link>
      </div>
    </li>
  );
}

function RecentsSection({
  recentRoutes,
  enteringId,
  spilledRoute,
}: {
  recentRoutes: SideNavLink[];
  enteringId: string | null;
  /** Dropped bottom row kept mounted during insert so the list does not jump up. */
  spilledRoute: SideNavLink | null;
}) {
  const [open, setOpen] = React.useState(readRecentsOpen);

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

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      writeRecentsOpen(next);
      return next;
    });
  }

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
        onClick={toggleOpen}
        className={cn(
          "relative flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground outline-none",
          "hover:bg-sidebar-accent hover:text-primary",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        )}
        aria-expanded={open}
      >
        <ClockIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-start">Recents</span>
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-sidebar-foreground/70 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
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

function CollapsedSideNav({
  pathname,
  recentRoutes,
}: {
  pathname: string;
  recentRoutes: SideNavLink[];
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-full"
            render={
              <SidebarMenuButton tooltip="Recents" isActive={false}>
                <ClockIcon />
                <span>Recents</span>
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            {recentRoutes.length === 0 ? (
              <DropdownMenuItem disabled>No recent pages</DropdownMenuItem>
            ) : (
              recentRoutes.map((route) => {
                const Icon = iconForRecentPath(route.href);
                return (
                  <DropdownMenuItem
                    key={route.id}
                    render={<Link to={route.href} />}
                    className="items-start gap-2"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <span className="truncate">{route.label}</span>
                      {route.caption ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {route.caption}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
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
              render={<NavLink to={item.to} end={item.to === "/dashboard"} />}
            >
              <Icon />
              <span>{item.label}</span>
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
      if (!href || !item.isFolder()) return;
      // Clicking an open section should only collapse — navigating would
      // change the route and the active-section sync would re-expand it.
      if (item.isExpanded()) return;
      if (!pathMatches(pathname, href)) {
        void navigate(href);
      }
    },
    dataLoader: {
      getItem: (itemId) => items[itemId],
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <Tree indent={indent} tree={tree} toggleIconType="chevron">
      {tree.getItems().map((item) => {
        const navItem = item.getItemData();
        const isFolder = item.isFolder();
        const href = navItem.href;
        const isActive = activeIds.includes(item.getId());
        const Icon = navItem.icon;

        return (
          <TreeItem
            key={item.getId()}
            item={item}
            data-active={isActive || undefined}
            render={
              !isFolder && href ? (
                <Link to={href} prefetch="intent" />
              ) : undefined
            }
          >
            <TreeItemLabel
              showToggleIcon={false}
              className={cn(
                "relative w-full gap-1.5 text-sidebar-foreground before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md",
                "hover:bg-sidebar-accent hover:text-primary hover:before:bg-sidebar-accent",
                "in-focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent font-medium text-primary before:bg-sidebar-accent"
                  : "bg-transparent before:bg-sidebar",
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className="min-w-0 flex-1 truncate text-start">
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

type RecentRoutesActionData = {
  ok?: boolean;
  routes?: SideNavLink[];
  error?: string;
};

export function AppSideNav({ data }: { data: SideNavData }) {
  const location = useLocation();
  const { open, hoverOpen, isMobile } = useSidebar();
  // Visual rail width (includes temporary hover-expand). Keep both nav
  // trees mounted so hover does not remount and flicker Recents open/closed.
  const showExpandedNav = open || hoverOpen || isMobile;
  const fetcher = useFetcher<RecentRoutesActionData>();
  const lastRecordedPathRef = React.useRef("");
  const recentRoutesRef = React.useRef(data.recentRoutes);
  const enterClearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const loaderRoutesKey = data.recentRoutes
    .map((r) => `${r.href}:${r.label}`)
    .join("|");
  const [loaderKey, setLoaderKey] = React.useState(loaderRoutesKey);
  const [recentRoutes, setRecentRoutes] = React.useState(data.recentRoutes);
  const [enteringId, setEnteringId] = React.useState<string | null>(null);
  const [spilledRoute, setSpilledRoute] = React.useState<SideNavLink | null>(
    null,
  );

  React.useEffect(() => {
    recentRoutesRef.current = recentRoutes;
  }, [recentRoutes]);

  if (loaderRoutesKey !== loaderKey) {
    setLoaderKey(loaderRoutesKey);
    setRecentRoutes(data.recentRoutes);
    setSpilledRoute(null);
  }

  // Prefer the latest API stack when the fetcher returns (render-time sync).
  // Ignore stale responses that no longer match the current path.
  const currentRecentPath = normalizeRecentPath(location.pathname);
  const apiRoutes = fetcher.data?.routes;
  const apiTop = apiRoutes?.[0]?.href ?? "";
  const apiRoutesKey = apiRoutes?.map((r) => `${r.href}:${r.label}`).join("|");
  const [appliedApiKey, setAppliedApiKey] = React.useState<string | null>(null);
  if (
    apiRoutes &&
    apiRoutesKey &&
    apiRoutesKey !== appliedApiKey &&
    (!currentRecentPath || apiTop === currentRecentPath)
  ) {
    setAppliedApiKey(apiRoutesKey);
    setRecentRoutes(apiRoutes);
    // Keep spilledRoute until the enter timer clears so the list does not jump up.
  }

  React.useEffect(
    () => () => {
      if (enterClearTimerRef.current !== null) {
        clearTimeout(enterClearTimerRef.current);
      }
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

    const formData = new FormData();
    formData.set("path", path);
    fetcher.submit(formData, {
      method: "post",
      action: "/api/recent-routes",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record once per path; fetcher identity is unstable
  }, [location.pathname]);

  return (
    <>
      <div
        className={cn(!showExpandedNav && "hidden")}
        // Keep mounted while icon-rail; only hide so hover expand does not remount.
        inert={!showExpandedNav ? true : undefined}
      >
        <nav aria-label="Main" className="px-1">
          <RecentsSection
            recentRoutes={recentRoutes}
            enteringId={enteringId}
            spilledRoute={spilledRoute}
          />
          <SideNavTree data={data} pathname={location.pathname} />
        </nav>
      </div>
      <div
        className={cn(showExpandedNav && "hidden")}
        inert={showExpandedNav ? true : undefined}
      >
        <CollapsedSideNav
          pathname={location.pathname}
          recentRoutes={recentRoutes}
        />
      </div>
    </>
  );
}
