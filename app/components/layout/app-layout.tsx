import * as React from "react";
import {
  Link,
  NavLink,
  Outlet,
  useFetcher,
  useLocation,
  useNavigation,
} from "react-router";
import {
  LayoutDashboardIcon,
  UsersIcon,
  FileTextIcon,
  BarChart3Icon,
  SettingsIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import { Logo } from "~/components/logo";
import { UserAvatar } from "~/components/ui/user-avatar";
import { Toaster } from "~/components/ui/sonner";
import { useSuccessToastFromSearch } from "~/hooks/use-success-toast";
import {
  AppBreadcrumb,
  type AppBreadcrumbItem,
} from "~/components/layout/app-breadcrumb";
import { GlobalSearch } from "~/components/layout/global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { ThemeToggle } from "~/components/theme-toggle";
import { Badge } from "~/components/reui/badge";
import { Spinner } from "~/components/ui/spinner";
import { TooltipProvider } from "~/components/ui/tooltip";
import {
  getAppEnvironment,
  getAppEnvironmentBadgeClass,
  getAppVersion,
} from "~/lib/app-version";
import { APP_NAME } from "~/lib/brand";
import type { BrokerSession } from "~/lib/db/types";
import { cn } from "~/lib/utils";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    match: (path: string) => path === "/dashboard",
  },
  {
    to: "/clients",
    label: "Clients",
    icon: UsersIcon,
    match: (path: string) =>
      path === "/clients" || path.startsWith("/clients/"),
  },
  {
    to: "/policies",
    label: "Policies",
    icon: FileTextIcon,
    match: (path: string) =>
      path === "/policies" || path.startsWith("/policies/"),
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3Icon,
    match: (path: string) =>
      path === "/reports" || path.startsWith("/reports/"),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    match: (path: string) =>
      path === "/settings" || path.startsWith("/settings/"),
  },
];

export function AppLayout({ broker }: { broker: BrokerSession }) {
  const location = useLocation();
  const navigation = useNavigation();
  const logoutFetcher = useFetcher();
  const loggingOut =
    logoutFetcher.state !== "idle" ||
    (navigation.state !== "idle" && navigation.formAction?.includes("/logout"));
  const [searchOpen, setSearchOpen] = React.useState(false);
  useSuccessToastFromSearch();
  const appVersion = getAppVersion();
  const appEnv = getAppEnvironment(appVersion);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarHeader className="flex h-14 shrink-0 flex-row items-center gap-1 overflow-hidden border-b border-sidebar-border px-2 group-data-[collapsible=icon]:justify-center">
            <Link
              to="/dashboard"
              className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-1 group-data-[collapsible=icon]:hidden"
            >
              <Logo size="sm" tone="invert" className="min-w-0" />
              <span className="sr-only">{APP_NAME}</span>
            </Link>
            <Link
              to="/dashboard"
              className="hidden size-8 items-center justify-center group-data-[collapsible=icon]:flex"
              aria-label={`${APP_NAME} dashboard`}
            >
              <img
                src="/apple-touch-icon.png"
                alt=""
                className="size-7 rounded-md object-contain"
              />
            </Link>
            <SidebarTrigger className="shrink-0" aria-label="Toggle sidebar" />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={`${item.label}-${item.to}`}>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={item.match(location.pathname)}
                          render={
                            <NavLink
                              to={item.to}
                              end={item.to === "/dashboard"}
                            />
                          }
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <div className="px-2 py-1">
              <Badge
                variant="outline"
                className={cn(
                  "max-w-full truncate font-mono text-[10px] tabular-nums",
                  getAppEnvironmentBadgeClass(appEnv),
                )}
                title={`App version ${appVersion}`}
              >
                {appVersion}
              </Badge>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="relative z-0 min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
            {/* Mobile: open sheet. Desktop toggle lives in the sidebar header. */}
            <SidebarTrigger className="md:hidden" aria-label="Open menu" />
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
            <div className="ml-auto flex min-w-0 items-center gap-3">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  aria-label="Account menu"
                >
                  <UserAvatar
                    email={broker.email}
                    fullName={broker.fullName}
                    userId={broker.id}
                    avatarR2Key={broker.avatarR2Key}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {broker.fullName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {broker.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      render={<Link to={`/settings/users?edit=${broker.id}`} />}
                    >
                      <UserIcon />
                      Profile
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={loggingOut}
                    onClick={() => {
                      void logoutFetcher.submit(null, {
                        method: "post",
                        action: "/logout",
                      });
                    }}
                  >
                    {loggingOut ? <Spinner /> : <LogOutIcon />}
                    {loggingOut ? "Logging out…" : "Log out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="relative z-0 min-w-0 flex-1 p-4 md:p-8">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export function PageHeader({
  title,
  titleAddon,
  description,
  action,
  breadcrumbs,
}: {
  title: string;
  /** Shown inline after the title (e.g. a status badge). */
  titleAddon?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs: AppBreadcrumbItem[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <AppBreadcrumb items={breadcrumbs} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {titleAddon}
          </div>
          {description ? (
            <div className="mt-1 text-sm text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
