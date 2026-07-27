import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { MobileMenuItem } from "./mobile-menu-item";

const simpleMenu = {
  type: "menu",
  id: "dash",
  name: "Dashboard",
  path: "/app/dashboard",
  badge: "New",
} as never;

const parentMenu = {
  type: "menu",
  id: "deploy",
  name: "Deployment",
  path: "/app/deployment",
  children: [
    {
      type: "menu",
      id: "repos",
      name: "Repositories",
      path: "/app/deployment/repos",
    },
  ],
} as never;

describe("MobileMenuItem", () => {
  it("renders a leaf menu item with a badge", () => {
    renderWithProviders(<MobileMenuItem menu={simpleMenu} onClick={vi.fn()} />, {
      route: "/app/dashboard",
    });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("opens a submenu sheet and renders child links", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <MobileMenuItem menu={parentMenu} onClick={onClick} />,
      { route: "/app/deployment" },
    );
    await user.click(screen.getByText("Deployment"));
    const child = await screen.findByText("Repositories");
    fireEvent.click(child);
    expect(onClick).toHaveBeenCalled();
  });
});
