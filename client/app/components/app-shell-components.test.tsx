import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUser: () => ({ data: { data: { firstName: "Jane", lastName: "Doe" } } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth", () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { BlocksAppLauncher } from "./blocks-app-launcher/blocks-app-launcher";
import { LanguageSelector } from "./language-selector/language-selector";
import { UserDropdownMenu } from "./user-dropdown-menu/user-dropdown-menu";
import { DesktopMenuItem } from "./menus/desktop-menu-item";
import { MobileMenuItem } from "./menus/mobile-menu-item";
import type { Menu } from "@/models/menu.model";

const menuWithChildren = {
  type: "menu",
  id: "deployment",
  name: "Deployment",
  path: "/app/deployment",
  children: [
    { type: "menu", id: "child", name: "Child", path: "/app/deployment/child" },
  ],
} as Menu;

const simpleMenu = {
  type: "menu",
  id: "dashboard",
  name: "Dashboard",
  path: "/app/dashboard",
  badge: "new",
} as Menu;

describe("BlocksAppLauncher", () => {
  it("renders the launcher trigger and opens the app grid", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<BlocksAppLauncher />);
    const trigger = screen.getByLabelText("SELISE Blocks apps");
    await user.click(trigger);
    expect(
      await screen.findByText(/favourite|apps/i, { exact: false }),
    ).toBeTruthy();
  });
});

describe("LanguageSelector", () => {
  it("shows the current language and opens the menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<LanguageSelector />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("English")).toBeInTheDocument();
  });
});

describe("UserDropdownMenu", () => {
  it("opens the user menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<UserDropdownMenu />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("My profile")).toBeInTheDocument();
  });
});

describe("menu items", () => {
  it("renders a desktop menu item with a badge", () => {
    renderWithProviders(<DesktopMenuItem menu={simpleMenu} isSidebarOpen />, {
      route: "/app/dashboard",
    });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders a desktop menu item with children", () => {
    renderWithProviders(
      <DesktopMenuItem menu={menuWithChildren} isSidebarOpen />,
      { route: "/app/deployment" },
    );
    expect(screen.getByText("Deployment")).toBeInTheDocument();
  });

  it("renders a mobile menu item", () => {
    renderWithProviders(<MobileMenuItem menu={simpleMenu} />, {
      route: "/app/dashboard",
    });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
