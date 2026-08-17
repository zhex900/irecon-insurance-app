import {
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  UserIcon,
} from "lucide-react";
import * as React from "react";
import { Link, Outlet, useFetcher, useNavigation } from "react-router";

import { SessionTimeoutDialog } from "~/components/auth/session-timeout-dialog";
import {
  AppBreadcrumb,
  type AppBreadcrumbItem,
} from "~/components/layout/app-breadcrumb";
import { AppSideNav } from "~/components/layout/app-side-nav";
import { GlobalSearch } from "~/components/layout/global-search";
import { NavigationProgress } from "~/components/layout/navigation-progress";
import { OfflineDialog } from "~/components/layout/offline-dialog";
import { Logo } from "~/components/logo";
import { Badge } from "~/components/reui/badge";
import { ThemeProvider } from "~/components/theme/theme-provider";
import { ThemeToggle } from "~/components/theme/theme-toggle";
import { Button } from "~/components/ui/button";
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/sonner";
import { Spinner } from "~/components/ui/spinner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { UserAvatar } from "~/components/ui/user-avatar";
import { useHydrated } from "~/hooks/network";
import { useSuccessToastFromSearch } from "~/hooks/utilities";
import {
  getAppEnvironment,
  getAppEnvironmentBadgeClass,
  getAppVersion,
} from "~/lib/app-version";
import type { SessionTimeoutClientState } from "~/lib/auth/session";
import { APP_NAME } from "~/lib/brand";
import type { Theme } from "~/lib/cookies";
import type { BrokerSession } from "~/lib/db/types";
import { SentryUserSync } from "~/lib/observability/sentry-user-sync";
import type { SideNavData } from "~/lib/services/navigation/side-nav.service";
import {
  type NavSectionId,
  writeNavSectionsCookie,
  writeRecentsOpenCookie,
  writeSidebarOpenCookie,
} from "~/lib/services/navigation/sidebar-state";
import { cn } from "~/lib/utils";

function SidebarBrand() {
  const { isMobile, state } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  if (isMobile) {
    return (
      <>
        <Link
          to="/dashboard"
          className="flex w-max items-center gap-2 px-1"
          aria-label={`${APP_NAME} dashboard`}
        >
          <Logo showTagline={false} className="text-sidebar-foreground" />
          <span className="sr-only">{APP_NAME}</span>
        </Link>
        <SidebarTrigger className="shrink-0" aria-label="Toggle sidebar" />
      </>
    );
  }

  if (collapsed) {
    return (
      <Link
        to="/dashboard"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent"
        aria-label={`${APP_NAME} dashboard`}
      >
        <img
          src="/favicon.png"
          alt=""
          className="size-7 rounded-md object-contain"
        />
      </Link>
    );
  }

  return (
    <Link
      to="/dashboard"
      className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-1"
    >
      <Logo showTagline={false} className="text-sidebar-foreground" />
      <span className="sr-only">{APP_NAME}</span>
    </Link>
  );
}

function SidebarCollapseToggle() {
  const { open, isMobile, toggleSidebar } = useSidebar();
  if (isMobile) return null;

  const label = open ? "Collapse sidebar" : "Expand sidebar";
  const Icon = open ? PanelLeftCloseIcon : PanelLeftOpenIcon;

  return (
    <Button
      type="button"
      data-sidebar="trigger"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      aria-label={label}
      title={label}
      onClick={toggleSidebar}
    >
      <Icon className="size-4" />
    </Button>
  );
}

export function AppLayout({
  broker,
  sideNav,
  sidebarOpen = true,
  recentsOpen = false,
  navSectionsExpanded = [],
  sessionTimeout = null,
  theme = "system",
  content,
}: {
  broker: BrokerSession;
  sideNav: SideNavData;
  /** Pinned sidebar open state from cookie (SSR). */
  sidebarOpen?: boolean;
  /** Recents section open state from cookie (SSR). */
  recentsOpen?: boolean;
  /** Expanded Reports/Settings sections from cookie + path (SSR). */
  navSectionsExpanded?: NavSectionId[];
  /** Idle / absolute session limits for the client timeout dialog. */
  sessionTimeout?: SessionTimeoutClientState | null;
  /** Saved theme preference from cookie (SSR). */
  theme?: Theme;
  /** When set (e.g. layout ErrorBoundary), replace the route Outlet. */
  content?: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [shellNav, setShellNav] = React.useState({
    sidebarOpen,
    recentsOpen,
    navSectionsExpanded,
  });
  useSuccessToastFromSearch();
  const appVersion = getAppVersion();
  const appEnv = getAppEnvironment(appVersion);

  const handleSidebarOpenChange = React.useCallback((open: boolean) => {
    setShellNav((prev) => ({
      ...prev,
      sidebarOpen: open,
      recentsOpen: open ? prev.recentsOpen : false,
    }));
    writeSidebarOpenCookie(open);
    if (!open) writeRecentsOpenCookie(false);
  }, []);

  const handleRecentsOpenChange = React.useCallback((open: boolean) => {
    setShellNav((prev) => ({
      ...prev,
      recentsOpen: open,
      sidebarOpen: open ? true : prev.sidebarOpen,
    }));
    writeRecentsOpenCookie(open);
    if (open) writeSidebarOpenCookie(true);
  }, []);

  const handleNavSectionsChange = React.useCallback(
    (navSectionsExpanded: NavSectionId[]) => {
      setShellNav((prev) => ({ ...prev, navSectionsExpanded }));
      writeNavSectionsCookie(navSectionsExpanded);
    },
    [],
  );

  return (
    <ThemeProvider initialTheme={theme} enableSystem>
      <TooltipProvider>
        <SentryUserSync userId={broker.id} email={broker.email} />
        <NavigationProgress />
        <OfflineDialog />
        <SessionTimeoutDialog config={sessionTimeout} />
        <SidebarProvider
          open={shellNav.sidebarOpen}
          onOpenChange={handleSidebarOpenChange}
        >
          <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="flex h-14 w-full shrink-0 flex-row items-center gap-1 border-b border-sidebar-border px-2 group-data-[collapsible=icon]:justify-center">
              <SidebarBrand />
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <AppSideNav
                    data={sideNav}
                    recentsOpen={shellNav.recentsOpen}
                    sidebarExpanded={shellNav.sidebarOpen}
                    navSectionsExpanded={shellNav.navSectionsExpanded}
                    onRecentsOpenChange={handleRecentsOpenChange}
                    onNavSectionsChange={handleNavSectionsChange}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border">
              <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <Badge
                  variant="outline"
                  className={cn(
                    "max-w-full truncate font-mono text-[10px] tabular-nums group-data-[collapsible=icon]:hidden",
                    getAppEnvironmentBadgeClass(appEnv),
                  )}
                  title={`App version ${appVersion}`}
                >
                  {appVersion}
                </Badge>
                <SidebarCollapseToggle />
              </div>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="relative z-0 min-w-0 overflow-x-hidden">
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
              {/* Mobile: open sheet. Desktop toggle lives in the sidebar footer. */}
              <SidebarTrigger className="md:hidden" aria-label="Open menu" />
              <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
              <div className="ml-auto flex min-w-0 items-center gap-3">
                <ThemeToggle />
                <AccountMenu broker={broker} />
              </div>
            </header>

            <div className="relative z-0 min-w-0 flex-1 p-4 md:p-8">
              {content ?? <Outlet />}
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function AccountMenu({ broker }: { broker: BrokerSession }) {
  const hydrated = useHydrated();
  const navigation = useNavigation();
  const logoutFetcher = useFetcher();
  const loggingOut =
    logoutFetcher.state !== "idle" ||
    (navigation.state !== "idle" && navigation.formAction?.includes("/logout"));

  return (
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
      {hydrated && (
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
            <DropdownMenuItem render={<Link to="/profile" />}>
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
      )}
    </DropdownMenu>
  );
}

export function PageHeader({
  title,
  titleAddon,
  description,
  action,
  breadcrumbs,
}: {
  title: React.ReactNode;
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
            {typeof title === "string" ? (
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            ) : (
              title
            )}
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
