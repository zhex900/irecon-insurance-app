import * as React from "react";
import { Link, NavLink, useLocation } from "react-router";
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import type {
  SideNavData,
  SideNavLink,
} from "~/lib/services/navigation/side-nav.service";
import { cn } from "~/lib/utils";

type SectionId = "reports" | "settings";

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
  to: string;
  label: string;
  icon: LucideIcon;
  section?: SectionId;
}[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/clients", label: "Clients", icon: UsersIcon },
  { to: "/policies", label: "Policies", icon: FileTextIcon },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3Icon,
    section: "reports",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    section: "settings",
  },
];

function sectionFromPath(pathname: string): SectionId | null {
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings";
  }
  return null;
}

function NavRow({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors",
        "hover:bg-sidebar-accent hover:text-primary",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function SectionBlock({
  to,
  label,
  icon: Icon,
  childrenLinks,
  open,
  onToggle,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  childrenLinks: SideNavLink[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-primary">
        <Link
          to={to}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-inherit"
        >
          <Icon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </Link>
        <button
          type="button"
          data-tree-toggle
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={open}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-primary"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle();
          }}
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform duration-200 ease-out",
              open && "rotate-90",
            )}
          />
        </button>
      </div>

      {open ? (
        <div className="flex animate-in flex-col pb-0.5 duration-150 fade-in-0 slide-in-from-top-1">
          {childrenLinks.map((child) => {
            const ChildIcon = CHILD_ICONS[child.id] ?? FileTextIcon;
            return (
              <Link
                key={child.id}
                to={child.href}
                prefetch="intent"
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md py-1.5 ps-6 pe-2 text-sm text-sidebar-foreground transition-colors",
                  "hover:bg-sidebar-accent hover:text-primary",
                )}
              >
                <ChildIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AppSideNav({ data }: { data: SideNavData }) {
  const location = useLocation();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const activeSection = sectionFromPath(location.pathname);

  const [openSections, setOpenSections] = React.useState<
    Record<SectionId, boolean>
  >(() => ({
    reports: activeSection === "reports",
    settings: activeSection === "settings",
  }));
  const [lastActiveSection, setLastActiveSection] =
    React.useState(activeSection);

  // Keep the active section open when moving between its pages.
  // Adjust during render (React-supported) instead of an effect.
  if (activeSection !== lastActiveSection) {
    setLastActiveSection(activeSection);
    if (activeSection && !openSections[activeSection]) {
      setOpenSections({ ...openSections, [activeSection]: true });
    }
  }

  const toggleSection = React.useCallback((section: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  if (collapsed) {
    return (
      <SidebarMenu>
        {TOP_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                tooltip={item.label}
                isActive={
                  item.to === "/dashboard"
                    ? location.pathname === "/dashboard"
                    : location.pathname === item.to ||
                      location.pathname.startsWith(`${item.to}/`)
                }
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

  return (
    <nav className="flex flex-col gap-0.5 px-1">
      {TOP_LINKS.map((item) => {
        if (item.section === "reports") {
          return (
            <SectionBlock
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              childrenLinks={data.reports}
              open={openSections.reports}
              onToggle={() => toggleSection("reports")}
            />
          );
        }
        if (item.section === "settings") {
          return (
            <SectionBlock
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              childrenLinks={data.settings}
              open={openSections.settings}
              onToggle={() => toggleSection("settings")}
            />
          );
        }
        return (
          <NavRow
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
          />
        );
      })}
    </nav>
  );
}
