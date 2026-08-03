import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardLayoutProvider } from "@/contexts/dashboard-layout-provider";

vi.mock("@/cross-modules/identifier/hooks/use-project", () => ({
  useGetProjects: () => ({ data: [], isLoading: false }),
  useGetProject: () => ({ data: undefined }),
}));

import { SidebarMenuDesktop } from "./sidebar-menu-desktop/sidebar-menu-desktop";
import { SidebarMobileView } from "./sidebar-mobile-view/sidebar-mobile-view";

const wrap = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={["/app/deployment"]}>
      <DashboardLayoutProvider isOpen>{ui}</DashboardLayoutProvider>
    </MemoryRouter>,
  );

describe("sidebar components", () => {
  it("renders the desktop sidebar menu", () => {
    wrap(<SidebarMenuDesktop />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("renders the mobile sidebar view", () => {
    wrap(<SidebarMobileView />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
