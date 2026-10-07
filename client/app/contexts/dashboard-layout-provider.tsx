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
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(isOpen);
  const [isSidebarSubMenuOpen, setIsSidebarSubMenuOpen] = useState(isSubMenuOpen);
  const [subMenuId, setSubMenuId] = useState<string | null>(() =>
    localStorage.getItem("subMenuId"),
  );
  const [servicesSearchTerm, setServicesSearchTerm] = useState("");

  // Sidebar state follows isMobile / persist / pathname changes. These are adjusted
  // during render (React's "adjusting state when a prop changes" pattern) instead of in
  // effects: each rule below fires on the same input changes it always has, and the
  // rules apply in the same order, so later rules win when several fire together.
  const [hasRestoredPersisted, setHasRestoredPersisted] = useState(false);
  const [syncedInputs, setSyncedInputs] = useState<{
    isMobile: boolean;
    persist: boolean;
    pathname: string;
    isSidebarOpen: boolean;
  } | null>(null);

  // Restore the persisted open state once, the first time persistence is active.
  const shouldRestorePersisted = persist && !hasRestoredPersisted;
  // Runs on mount and whenever isMobile or persist changes.
  const shouldSyncOpenToViewport =
    syncedInputs === null ||
    syncedInputs.isMobile !== isMobile ||
    syncedInputs.persist !== persist;
  // Runs on mount and whenever pathname or isMobile changes.
  const shouldSyncSubMenuToRoute =
    syncedInputs === null ||
    syncedInputs.pathname !== pathname ||
    syncedInputs.isMobile !== isMobile;
  // Runs on mount and whenever isSidebarOpen or isMobile changes.
  const shouldSyncSubMenuToSidebar =
    syncedInputs === null ||
    syncedInputs.isSidebarOpen !== isSidebarOpen ||
    syncedInputs.isMobile !== isMobile;

  if (
    shouldRestorePersisted ||
    shouldSyncOpenToViewport ||
    shouldSyncSubMenuToRoute ||
    shouldSyncSubMenuToSidebar
  ) {
    setSyncedInputs({ isMobile, persist, pathname, isSidebarOpen });

    if (shouldRestorePersisted) {
      setHasRestoredPersisted(true);
      if (!isMobile) {
        const stored = localStorage.getItem(storageKey);
        if (stored !== null) {
          setIsSidebarOpen(JSON.parse(stored) as boolean);
        }
      } else {
        setIsSidebarOpen(false);
      }
    }

    if (shouldSyncOpenToViewport) {
      if (!persist) {
        setIsSidebarOpen(!isMobile);
      } else if (isMobile) {
        setIsSidebarOpen(false);
      }
    }

    if (shouldSyncSubMenuToRoute && !isMobile && pathname.startsWith("/services")) {
      setIsSidebarSubMenuOpen(true);
    }

    if (shouldSyncSubMenuToSidebar && isSidebarOpen && !isMobile) {
      setIsSidebarSubMenuOpen(false);
    }
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