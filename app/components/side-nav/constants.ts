import {
  BadgeDollarSignIcon,
  BarChart3Icon,
  ContactIcon,
  FileBarChart2Icon,
  FilePenLineIcon,
  FileStackIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MailIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";

import type { NavSectionId } from "~/lib/services/navigation/sidebar-state";

export type SectionId = NavSectionId;

export type TopNavLink = {
  id: string;
  to: string;
  label: string;
  icon: LucideIcon;
  section?: SectionId;
};

export const CHILD_ICONS: Record<string, LucideIcon> = {
  "report-car-policies": FileBarChart2Icon,
  "report-car-renewals": RefreshCwIcon,
  "settings-users": UserCogIcon,
  "settings-ar-brokers": UsersIcon,
  "settings-account-managers": ContactIcon,
  "settings-email-templates": MailIcon,
  "settings-library-documents": FileStackIcon,
  "settings-document-templates": FilePenLineIcon,
  "settings-features": SlidersHorizontalIcon,
  "settings-audit-log": ScrollTextIcon,
  "settings-prices": BadgeDollarSignIcon,
};

export const TOP_LINKS: TopNavLink[] = [
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
export const submenuStartClass =
  "ps-[calc(0.5rem+var(--side-nav-indent,16px))]";

export const navRowClass =
  "relative flex h-8 w-max cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring";

export const navRowActiveClass =
  "bg-sidebar-accent font-medium text-primary before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:rounded-md before:bg-sidebar-accent";
