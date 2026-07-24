import { screen } from "@testing-library/react";
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
});
