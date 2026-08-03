import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";

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
});
