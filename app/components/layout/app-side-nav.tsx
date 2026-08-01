import * as React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
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
import type { SideNavData } from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

type SectionId = "reports" | "settings";

type NavItem = {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: string[];
};

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
    if (id === "root" || !item.href) continue;
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

function CollapsedSideNav({ pathname }: { pathname: string }) {
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
        const Icon = navItem.icon ?? FileTextIcon;
        const isFolder = item.isFolder();
        const href = navItem.href;
        const isActive = activeIds.includes(item.getId());

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
              <Icon className="size-4 shrink-0" />
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

export function AppSideNav({ data }: { data: SideNavData }) {
  const location = useLocation();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  if (collapsed) {
    return <CollapsedSideNav pathname={location.pathname} />;
  }

  return (
    <nav aria-label="Main" className="px-1">
      <SideNavTree data={data} pathname={location.pathname} />
    </nav>
  );
}
