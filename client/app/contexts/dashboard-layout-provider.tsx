import React, { createContext, useCallback, useState } from "react";
import { useLocation } from "react-router";
import useIsMobile from "@/hooks/use-is-mobile";

type SidebarContextValue = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  closeWithoutPersist: () => void;
  isSidebarSubMenuOpen: boolean;
  toggleSidebarSubMenu: () => void;
  showSidebarSubMenu: () => void;
  subMenuId: string | null;
  updateSubMenuId: (id: string) => void;
  servicesSearchTerm: string;
  updateServicesSearchTerm: (term: string) => void;
};

const defaultContextValue: SidebarContextValue = {
  isSidebarOpen: false,
  toggleSidebar: () => undefined,
  closeSidebar: () => undefined,
  closeWithoutPersist: () => undefined,
  isSidebarSubMenuOpen: false,
  toggleSidebarSubMenu: () => undefined,
  showSidebarSubMenu: () => undefined,
  subMenuId: null,
  updateSubMenuId: () => undefined,
  servicesSearchTerm: "",
  updateServicesSearchTerm: () => undefined,
};

export const SidebarContext = createContext<SidebarContextValue>(defaultContextValue);

/** The persisted desktop choice, or the fallback when nothing has been stored yet. */
function readStoredOpen(storageKey: string, fallback: boolean): boolean {
  const stored = localStorage.getItem(storageKey);
  return stored === null ? fallback : (JSON.parse(stored) as boolean);
}

// Where the sidebar starts: a persisted desktop choice wins, mobile always starts closed,
// and without persistence it simply follows the viewport.
function initialSidebarOpen(
  persist: boolean,
  isMobile: boolean,
  isOpen: boolean,
  storageKey: string,
): boolean {
  if (!persist) return !isMobile;
  if (isMobile) return false;
  return readStoredOpen(storageKey, isOpen);
}

function nextSidebarOpen({
  current,
  isMobile,
  persist,
  storageKey,
  readStored,
  layoutChanged,
}: {
  current: boolean;
  isMobile: boolean;
  persist: boolean;
  storageKey: string;
  readStored: boolean;
  layoutChanged: boolean;
}): boolean {
  let next = current;
  // The first time persistence is on, the stored choice applies (mobile stays closed).
  if (readStored) next = !isMobile && readStoredOpen(storageKey, next);
  // A viewport or persistence change: mobile closes; without persistence the sidebar
  // follows the viewport, with it a desktop keeps its current state.
  if (layoutChanged) next = persist ? next && !isMobile : !isMobile;
  return next;
}

function nextSubMenuOpen({
  current,
  isMobile,
  pathname,
  isSidebarOpen,
  viewportChanged,
  routeChanged,
  sidebarChanged,
}: {
  current: boolean;
  isMobile: boolean;
  pathname: string;
  isSidebarOpen: boolean;
  viewportChanged: boolean;
  routeChanged: boolean;
  sidebarChanged: boolean;
}): boolean {
  // The submenu only reacts on desktop.
  if (isMobile) return current;
  let next = current;
  if ((viewportChanged || routeChanged) && pathname.startsWith("/services")) next = true;
  if ((viewportChanged || sidebarChanged) && isSidebarOpen) next = false;
  return next;
}

export function DashboardLayoutProvider({
  children,
  isOpen,
  isSubMenuOpen = false,
  storageKey = "sidebar-open",
  persist = false,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  isSubMenuOpen?: boolean;
  storageKey?: string;
  persist?: boolean;
}) {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    initialSidebarOpen(persist, isMobile, isOpen, storageKey),
  );
  // The stored choice is read the first time persistence is on, and only then.
  const [hasReadStoredOpen, setHasReadStoredOpen] = useState(persist);

  const [isSidebarSubMenuOpen, setIsSidebarSubMenuOpen] = useState(() => {
    let open = isSubMenuOpen;
    // On a services route the submenu opens on desktop...
    if (!isMobile && pathname.startsWith("/services")) open = true;
    // ...unless the sidebar itself is open, which takes its place.
    if ((isOpen || isSidebarOpen) && !isMobile) open = false;
    return open;
  });
  const [subMenuId, setSubMenuId] = useState<string | null>(() =>
    localStorage.getItem("subMenuId"),
  );
  const [servicesSearchTerm, setServicesSearchTerm] = useState("");

  // React to viewport, route, persistence and sidebar changes while rendering, so the
  // adjusted state is in place before anything is painted. The rules are applied in the
  // same order the provider has always used.
  const [prevInputs, setPrevInputs] = useState({
    isMobile,
    pathname,
    persist,
    isSidebarOpen,
  });
  if (
    prevInputs.isMobile !== isMobile ||
    prevInputs.pathname !== pathname ||
    prevInputs.persist !== persist ||
    prevInputs.isSidebarOpen !== isSidebarOpen
  ) {
    const viewportChanged = prevInputs.isMobile !== isMobile;
    const readStored = persist && !hasReadStoredOpen;
    setPrevInputs({ isMobile, pathname, persist, isSidebarOpen });
    if (readStored) setHasReadStoredOpen(true);

    const nextOpen = nextSidebarOpen({
      current: isSidebarOpen,
      isMobile,
      persist,
      storageKey,
      readStored,
      layoutChanged: viewportChanged || prevInputs.persist !== persist,
    });
    if (nextOpen !== isSidebarOpen) setIsSidebarOpen(nextOpen);

    const nextSubMenu = nextSubMenuOpen({
      current: isSidebarSubMenuOpen,
      isMobile,
      pathname,
      isSidebarOpen,
      viewportChanged,
      routeChanged: prevInputs.pathname !== pathname,
      sidebarChanged: prevInputs.isSidebarOpen !== isSidebarOpen,
    });
    if (nextSubMenu !== isSidebarSubMenuOpen) setIsSidebarSubMenuOpen(nextSubMenu);
  }

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const nextState = !prev;
      if (persist && !isMobile) {
        localStorage.setItem(storageKey, JSON.stringify(nextState));
      }
      if (nextState) {
        setIsSidebarSubMenuOpen(false);
      }
      return nextState;
    });
  }, [isMobile, persist, storageKey]);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    if (persist && !isMobile) {
      localStorage.setItem(storageKey, JSON.stringify(false));
    }
  }, [isMobile, persist, storageKey]);

  const closeWithoutPersist = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const toggleSidebarSubMenu = useCallback(() => {
    setIsSidebarSubMenuOpen((prev) => !prev);
  }, []);

  const showSidebarSubMenu = useCallback(() => {
    setIsSidebarSubMenuOpen(true);
  }, []);

  const updateSubMenuId = useCallback((id: string) => {
    localStorage.setItem("subMenuId", id);
    setSubMenuId(id);
    setServicesSearchTerm("");
  }, []);

  const updateServicesSearchTerm = useCallback((term: string) => {
    setServicesSearchTerm(term);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        closeSidebar,
        closeWithoutPersist,
        isSidebarSubMenuOpen,
        toggleSidebarSubMenu,
        showSidebarSubMenu,
        subMenuId,
        updateSubMenuId,
        servicesSearchTerm,
        updateServicesSearchTerm,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}