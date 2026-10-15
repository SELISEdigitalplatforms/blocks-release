import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import {
  useAuthStore,
  useProjectStore,
  type CommandPaletteProps,
  type IProject,
} from "@seliseblocks/app-kit";
import { CommandPaletteProvider, useCommandPalette } from "./command-palette-provider";
import { ConsoleRoute } from "@/pages/console/console-route";

const h = vi.hoisted(() => ({
  props: null as CommandPaletteProps | null,
  start: vi.fn(),
  query: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: h.error } }));
vi.mock("@seliseblocks/app-kit", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    ConsolePage: ({ onOpenCommands }: { onOpenCommands?: () => void }) => (
      <input aria-label="Search projects" type="search" onFocus={onOpenCommands} />
    ),
    useFilteredMenus: (menus: unknown) => menus,
    useCommandLayer: () => "dashboard",
    useGetProjects: (options: unknown) => {
      h.query(options);
      return { data: undefined };
    },
    useStartImpersonation: () => ({ mutateAsync: h.start }),
    CommandPalette: (props: CommandPaletteProps) => {
      h.props = props;
      return props.open ? <div role="dialog">Command menu</div> : null;
    },
  };
});

function Controls() {
  const open = useCommandPalette();
  const { pathname } = useLocation();
  return (
    <>
      <button onClick={() => open(true)}>Search</button>
      <output>{pathname}</output>
    </>
  );
}

function setup() {
  return render(
    <MemoryRouter initialEntries={["/app/test-project-id/dashboard"]}>
      <Routes>
        <Route
          path="/app/:itemId"
          element={
            <CommandPaletteProvider>
              <Controls />
              <Outlet />
            </CommandPaletteProvider>
          }
        >
          <Route path="dashboard" element={<div>Overview</div>} />
          <Route path="deployment" element={<div>Deployment</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.props = null;
  h.start.mockReset().mockResolvedValue({});
  h.query.mockClear();
  h.error.mockClear();
  useAuthStore.setState({ isAuthenticated: true });
  useProjectStore.setState({
    selectedProject: {
      itemId: "test-project-id",
      tenantId: "tenant-old",
      tenantGroupId: "group-old",
      name: "Release",
      environment: "dev",
    } as IProject,
  });
});

describe("Release command palette integration", () => {
  it("opens from the console project search field", () => {
    render(
      <MemoryRouter initialEntries={["/app/console"]}>
        <CommandPaletteProvider>
          <ConsoleRoute />
        </CommandPaletteProvider>
      </MemoryRouter>,
    );
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search projects" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens and toggles with both Cmd+K and Ctrl+K", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "K", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("ignores unmodified K, repeats, and unauthenticated shortcuts", () => {
    setup();
    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true, repeat: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => useAuthStore.setState({ isAuthenticated: false }));
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fetches projects only while the palette is open", () => {
    setup();
    expect(h.query.mock.calls.every(([options]) => !options.enabled)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(h.query).toHaveBeenCalledWith({ enabled: true });
  });

  it("mirrors scoped Release destinations without Console-only project links", () => {
    setup();
    expect(h.props?.sections?.flatMap((section) => section.items.map((item) => item.path))).toEqual(
      ["/app/test-project-id/dashboard", "/app/test-project-id/deployment"],
    );
    expect(h.props?.projectGroups).toBeUndefined();
  });

  it("impersonates before updating selection and navigating to another environment", async () => {
    setup();
    const project = {
      itemId: "next",
      tenantId: "tenant-next",
      tenantGroupId: "group-next",
      name: "Next",
      environment: "stg",
    } as IProject;
    await act(async () => {
      await h.props?.onEnterEnvironment(project);
    });
    expect(h.start).toHaveBeenCalledWith({ targeted_tenant_id: "tenant-next" });
    expect(useProjectStore.getState().selectedProject?.itemId).toBe("next");
    expect(useProjectStore.getState().selectedTenantGroup).toBe("group-next");
    expect(screen.getByRole("status").textContent).toBe("/app/next/dashboard");
  });

  it("keeps the current selection and route when impersonation fails", async () => {
    h.start.mockRejectedValueOnce(new Error("Denied"));
    setup();
    const project = {
      itemId: "next",
      tenantId: "tenant-next",
      tenantGroupId: "group-next",
    } as IProject;
    await act(async () => {
      await h.props?.onEnterEnvironment(project);
    });
    await waitFor(() => expect(h.error).toHaveBeenCalled());
    expect(useProjectStore.getState().selectedProject?.itemId).toBe("test-project-id");
    expect(screen.getByRole("status").textContent).toBe("/app/test-project-id/dashboard");
  });
});
