import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useProjectStore } from "@/store/project.store";

vi.mock("@/cross-modules/deployment/hooks/use-alerts", () => ({
  useUpdateSingleMonitor: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateHealth: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMonitor: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteHealth: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { AlertsList, formatSeconds } from "./alerts-list";

const alertRow = {
  itemId: "m1",
  name: "Health check",
  operationName: "Health check",
  repoName: "acme/app",
  repoId: "r1",
  isActive: true,
  currentStatus: true,
  monitorType: 0,
  monitorConfigurationType: 0,
  monitorSourceType: 0,
  incidentSummaries: [],
  emails: [],
  subEntries: [],
  url: "https://acme.dev/health",
  timeoutInSeconds: 30,
} as never;

describe("formatSeconds", () => {
  it("formats seconds", () => {
    expect(formatSeconds(45)).toBe("45s");
  });
  it("formats minutes", () => {
    expect(formatSeconds(120)).toBe("2min");
  });
  it("formats hours", () => {
    expect(formatSeconds(7200)).toContain("h");
  });
  it("formats whole days", () => {
    expect(formatSeconds(86400 * 2 + 3600)).toBe("2d");
  });
});

describe("AlertsList", () => {
  it("renders the loading skeleton", () => {
    const { container } = renderWithProviders(
      <AlertsList data={[]} isLoading={true} />,
      { nuqs: true },
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders an empty table", () => {
    renderWithProviders(<AlertsList data={[]} isLoading={false} />, {
      nuqs: true,
    });
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("renders a monitor row with its actions and uptime bar", () => {
    renderWithProviders(
      <AlertsList data={[alertRow]} isLoading={false} totalCount={1} />,
      { nuqs: true },
    );
    expect(screen.getByText("Health check")).toBeInTheDocument();
  });

  it("keeps clicks and keystrokes on the actions cell out of the row", () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = renderWithProviders(
      <div onClick={onClick} onKeyDown={onKeyDown}>
        <AlertsList data={[alertRow]} isLoading={false} totalCount={1} />
      </div>,
      { nuqs: true },
    );
    // The actions cell is the wrapper around the row's dropdown trigger.
    const trigger = container.querySelector(
      '[aria-haspopup="menu"]',
    ) as HTMLElement;
    const actions = trigger.closest("div.justify-center") as HTMLElement;
    expect(actions).toBeTruthy();

    // Control: an event from any other cell does reach the row handler.
    fireEvent.keyDown(screen.getByText("Health check"), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    onKeyDown.mockClear();

    // The actions cell isolates its own events, so neither a click nor a
    // keystroke inside it reaches the surrounding row handler.
    fireEvent.click(actions);
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.keyDown(actions, { key: "Enter" });
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  describe("cell and pagination branches", () => {
    const NOW = Date.parse("2024-06-10T12:00:00Z");
    const originalProject = useProjectStore.getState().selectedProject;

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      // Unmount before resetting the shared store so the reset does not
      // re-render a still-mounted list outside act().
      cleanup();
      vi.restoreAllMocks();
      useProjectStore.setState({ selectedProject: originalProject });
    });

    const row = (overrides: Record<string, unknown>) =>
      ({
        ...(alertRow as unknown as Record<string, unknown>),
        createdDate: "2024-06-10T11:00:00Z",
        ...overrides,
      }) as never;

    const renderRows = (rows: never[], props = {}) =>
      renderWithProviders(
        <AlertsList data={rows} isLoading={false} {...props} />,
        { nuqs: true },
      );

    it.each([
      ["days and hours", "2024-06-08T09:00:00Z", "2d 3h"],
      ["hours and minutes", "2024-06-10T09:15:00Z", "2h 45m"],
      ["minutes and seconds", "2024-06-10T11:57:30Z", "2m 30s"],
      ["seconds only", "2024-06-10T11:59:45Z", "15s"],
    ])("formats uptime in %s since the last incident", (_, at, expected) => {
      renderRows([row({ lastIncidentAt: at })]);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("falls back to the created date when the last incident is the zero date", () => {
      renderRows([
        row({
          lastIncidentAt: "0001-01-01T00:00:00Z",
          createdDate: "2024-06-10T10:30:00Z",
        }),
      ]);
      expect(screen.getByText("1h 30m")).toBeInTheDocument();
    });

    it("falls back to the created date when no incident was recorded", () => {
      renderRows([
        row({ lastIncidentAt: undefined, createdDate: "2024-06-10T11:00:00Z" }),
      ]);
      expect(screen.getByText("1h 0m")).toBeInTheDocument();
    });

    it("shows an up arrow for a healthy monitor and a down arrow otherwise", () => {
      const { container, unmount } = renderRows([
        row({ currentStatus: true }),
      ]);
      expect(container.querySelector("svg.lucide-arrow-up.text-green-500")).toBeTruthy();
      expect(container.querySelector("svg.lucide-arrow-down.text-red-500")).toBeNull();
      unmount();

      const down = renderRows([row({ currentStatus: false })]);
      expect(down.container.querySelector("svg.lucide-arrow-down.text-red-500")).toBeTruthy();
      expect(down.container.querySelector("svg.lucide-arrow-up.text-green-500")).toBeNull();
    });

    it("labels request monitors and callback monitors", () => {
      renderRows([
        row({ itemId: "a", name: "Req", monitorConfigurationType: 0 }),
        row({ itemId: "b", name: "Cb", monitorConfigurationType: 1 }),
      ]);
      expect(screen.getByText("Request")).toBeInTheDocument();
      expect(screen.getByText("Callback")).toBeInTheDocument();
    });

    it("falls back to the operation name, then N/A, and shows N/A for a missing URL", () => {
      renderRows([
        row({ itemId: "a", name: "", operationName: "Op only", url: "https://x.dev" }),
        row({ itemId: "b", name: "", operationName: "", url: "" }),
      ]);
      expect(screen.getByText("Op only")).toBeInTheDocument();
      expect(screen.getByText("https://x.dev")).toBeInTheDocument();
      // One N/A for the nameless row's name and one for its URL.
      expect(screen.getAllByText("N/A")).toHaveLength(2);
    });

    it("hides the row actions for monitors with source type 2", () => {
      const { container } = renderRows([row({ monitorSourceTypes: 2 })]);
      expect(screen.getByText("Health check")).toBeInTheDocument();
      expect(container.querySelector("svg.lucide-ellipsis-vertical")).toBeNull();
    });

    it("offers Resume for a monitor whose active flag is missing", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      useProjectStore.setState({ selectedProject: null });
      const { container } = renderRows([
        row({ isActive: undefined, monitorConfigurationType: 1 }),
      ]);
      await user.click(
        container.querySelector("svg.lucide-ellipsis-vertical") as Element,
      );
      expect(await screen.findByText("Resume")).toBeInTheDocument();
      expect(screen.queryByText("Pause")).not.toBeInTheDocument();
    });

    it("hides pagination when everything fits on one page", () => {
      renderRows([row({})], { totalCount: 10, pageSize: 10, pageNumber: 0 });
      expect(
        screen.queryByRole("button", { name: "Next page" }),
      ).not.toBeInTheDocument();
    });

    it("paginates through the onPageChange callback when provided", () => {
      const onPageChange = vi.fn();
      renderRows([row({})], {
        totalCount: 25,
        pageSize: 10,
        pageNumber: 0,
        onPageChange,
      });
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("writes the page to the URL when no onPageChange is provided", async () => {
      const onUrlUpdate = vi.fn();
      renderWithProviders(
        <NuqsTestingAdapter onUrlUpdate={onUrlUpdate}>
          <AlertsList
            data={[row({})]}
            isLoading={false}
            totalCount={25}
            pageSize={10}
            pageNumber={1}
          />
        </NuqsTestingAdapter>,
      );
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Last page" }));
      await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
      const { searchParams } = onUrlUpdate.mock.calls.at(-1)?.[0] as {
        searchParams: URLSearchParams;
      };
      expect(searchParams.get("page")).toBe("2");
    });
  });
});
