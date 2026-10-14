import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router";
import { ChevronDown, ChevronUp, Search, UserRound } from "lucide-react";
import {
  AppSwitcher,
  BackToConsoleNavigator,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Logo,
  Notification,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  ThemeSwitcher,
  UserDropdownMenu,
  formatShortcut,
  useLogo,
  useProjectStore,
  useUserStore,
  type PaletteNavSection,
} from "@seliseblocks/app-kit";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";
import { useReleaseNavigation } from "@/hooks/use-release-navigation";

function NavGroup({ section }: { section: PaletteNavSection }) {
  const [open, setOpen] = useState(true);
  const { pathname } = useLocation();
  const items = (
    <SidebarMenu className={section.label ? "ml-4 border-l border-border pl-3" : undefined}>
      {section.items.map((item) => {
        const Icon = item.icon;
        const link = (
          <NavLink to={item.path}>
            {Icon && <Icon aria-hidden="true" />}
            <span>{item.name}</span>
          </NavLink>
        );
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.path || pathname.startsWith(`${item.path}/`)}
              className="min-h-10 rounded-sm px-3 text-[13px] text-medium-emphasis hover:bg-surface-warm data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
            >
              {link}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
  if (!section.label) return <div className="mb-1 border-y border-border py-2">{items}</div>;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-warm">
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">{items}</CollapsibleContent>
    </Collapsible>
  );
}

function ReleaseSidebar({
  sections,
  onOpenCommand,
}: {
  sections: PaletteNavSection[];
  onOpenCommand: () => void;
}) {
  const { appLightLogo, appDarkLogo } = useLogo();
  const { itemId } = useParams();
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const project = selectedProject?.itemId === itemId ? selectedProject : null;
  const { userDetails } = useUserStore();
  const initials =
    `${userDetails?.firstName?.[0] ?? ""}${userDetails?.lastName?.[0] ?? ""}`.toUpperCase();
  const fullName =
    [userDetails?.firstName, userDetails?.lastName].filter(Boolean).join(" ") || "Account";
  const searchButton = (
    <button
      type="button"
      onClick={onOpenCommand}
      aria-label="Open command menu"
      className="flex h-9 w-full items-center gap-2 rounded-sm bg-surface-warm px-3 text-left text-[13px] text-muted-foreground hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Search aria-hidden="true" className="h-4 w-4" />
      <span className="flex-1 truncate">Go anywhere...</span>
      <kbd className="rounded-[5px] border border-border bg-card px-1.5 py-0.5 font-mono text-[11px]">
        {formatShortcut({ key: "k", mod: true })}
      </kbd>
    </button>
  );

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-border"
      aria-label="Release sidebar"
    >
      <SidebarHeader className="gap-6 px-4 pb-0 pt-4">
        <Link to="/app/console" aria-label="Go to console" className="px-3">
          <Logo
            lightSrc={appLightLogo}
            darkSrc={appDarkLogo}
            alt="Blocks Release"
            className="h-auto w-[72px]"
          />
        </Link>
        {searchButton}
      </SidebarHeader>
      <SidebarContent className="px-4 pt-0">
        {project && (
          <section className="pb-2 pt-3">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Current Workspace
            </p>
            <button
              type="button"
              onClick={onOpenCommand}
              className="w-full rounded-sm px-3 py-2 text-left hover:bg-surface-warm"
            >
              <span className="block truncate text-[13px] font-medium text-high-emphasis">
                {project.name}
              </span>
              <span className="text-xs text-muted-foreground">{project.environment}</span>
            </button>
          </section>
        )}
        <nav aria-label="Release navigation">
          {sections.map((section) => (
            <NavGroup key={section.id} section={section} />
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="shrink-0 px-4 pb-4">
        <div className="flex items-center justify-between gap-3 px-2 pt-2">
          <span className="text-[13px] font-medium text-high-emphasis">Appearance</span>
          <ThemeSwitcher
            variant="segmented"
            className="border-0 bg-transparent [&_button[aria-pressed=true]]:bg-primary/15 [&_button[aria-pressed=true]]:text-primary"
          />
        </div>
        <div role="separator" className="my-2 border-t border-border" />
        <UserDropdownMenu
          align="start"
          trigger={
            <button
              type="button"
              aria-label="Open user menu"
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left hover:bg-surface-warm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">
                {initials || <UserRound className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-high-emphasis">
                  {fullName}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {userDetails?.email}
                </span>
              </span>
              <ChevronUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </button>
          }
        />
      </SidebarFooter>
    </Sidebar>
  );
}

function AppShellContent({
  children,
  sidebar = false,
}: {
  children: ReactNode;
  sidebar?: boolean;
}) {
  const sections = useReleaseNavigation();
  const [drawerRevision, setDrawerRevision] = useState(0);
  const openPalette = useCommandPalette();
  const { pathname } = useLocation();
  const title =
    sections
      .flatMap((section) => section.items)
      .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))?.name ??
    (pathname.endsWith("profile") ? "Profile" : "Console");
  const topbar = (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-background px-5">
      {sidebar && <SidebarTrigger className="md:hidden" aria-label="Open sidebar" />}
      <span className="text-sm font-medium text-high-emphasis">{title}</span>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Open command menu"
          onClick={() => openPalette(true)}
          className="rounded-sm p-2 text-muted-foreground hover:bg-surface-warm"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
        {sidebar && <BackToConsoleNavigator />}
        <Notification />
        <AppSwitcher />
        {!sidebar && <UserDropdownMenu showThemeToggle />}
      </div>
    </header>
  );
  if (!sidebar)
    return (
      <div className="flex min-h-screen flex-col bg-surface-app">
        {topbar}
        <main className="flex-1">{children}</main>
      </div>
    );
  // app-kit 0.1 keeps mobile drawer state private. Reset it after a destination
  // change or a command-menu launch so the drawer cannot cover the next screen.
  return (
    <SidebarProvider
      key={`${pathname}:${drawerRevision}`}
      open
      onOpenChange={() => undefined}
      className="release-shell"
    >
      <ReleaseSidebar
        sections={sections}
        onOpenCommand={() => {
          setDrawerRevision((value) => value + 1);
          openPalette(true);
        }}
      />
      <SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden bg-surface-app">
        {topbar}
        <div
          data-slot="dashboard-main"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AppShell(props: { children: ReactNode; sidebar?: boolean }) {
  return (
    <CommandPaletteProvider>
      <AppShellContent {...props} />
    </CommandPaletteProvider>
  );
}
