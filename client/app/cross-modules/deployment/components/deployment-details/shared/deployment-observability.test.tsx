import { createEvent, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DeploymentObservability from "./deployment-observability";
import type { IPipeline } from "@blocks-deployment/pages/repo-details";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const builds = [
  {
    itemId: "b1",
    repoId: "r1",
    status: "Succeeded",
    eventName: "deploy",
    createdDate: "2024-01-02T00:00:00Z",
    lastUpdatedDate: "2024-01-02T00:05:00Z",
  },
  {
    itemId: "b2",
    repoId: "r1",
    status: "Failed",
    eventName: "deploy",
    createdDate: "2024-01-01T00:00:00Z",
    lastUpdatedDate: "2024-01-01T00:05:00Z",
  },
] as unknown as IPipeline[];

describe("DeploymentObservability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the latest build view and navigates on row click", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    // The latest build is b1; clicking a SAST action navigates to its logs.
    const sast = screen.getAllByText("SAST")[0];
    fireEvent.click(sast);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=sast"),
    );
  });

  it("renders the full history view and opens a deployment", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getAllByText(/SAST|SCA|DAST/i).length).toBeGreaterThan(0);
    const scaActions = screen.getAllByText("SCA");
    fireEvent.click(scaActions[0]);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=sca"),
    );
  });

  it("opens the latest build row with Enter", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b1/ });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=deployment-logs"),
    );
  });

  it("opens the latest build row with Space and stops the page scrolling", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b1/ });
    const space = createEvent.keyDown(row, { key: " " });
    fireEvent(row, space);
    expect(space.defaultPrevented).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=deployment-logs"),
    );
  });

  it("ignores keys other than Enter and Space on the latest build row", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b1/ });
    const escape = createEvent.keyDown(row, { key: "Escape" });
    fireEvent(row, escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not open the latest build row from a nested action button", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    // Enter on the nested SAST button must not also fire the row navigation.
    const row = screen.getByRole("button", { name: /ID: b1/ });
    fireEvent.keyDown(within(row).getByRole("button", { name: /SAST/ }), {
      key: "Enter",
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("opens a history row with Enter and with Space", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b2/ });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment-logs/b2"),
    );
    const space = createEvent.keyDown(row, { key: " " });
    fireEvent(row, space);
    expect(space.defaultPrevented).toBe(true);
    expect(navigateMock).toHaveBeenCalledTimes(2);
  });

  it("renders every build handed in rather than trimming the list", () => {
    renderWithProviders(<DeploymentObservability builds={builds} />, {
      route: "/app/deployment/repo/r1",
    });
    expect(screen.getByRole("button", { name: /ID: b1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ID: b2/ })).toBeInTheDocument();
  });

  it("reports the page's range within the whole history, not within the page", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} startIndex={6} totalCount={28} />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getByText("Showing 6-7 of 28 deploys")).toBeInTheDocument();
  });

  it("falls back to the builds it was given when no total is supplied", () => {
    renderWithProviders(<DeploymentObservability builds={builds} />, {
      route: "/app/deployment/repo/r1",
    });
    expect(screen.getByText("Showing 1-2 of 2 deploys")).toBeInTheDocument();
  });

  it("reads sensibly on an empty page", () => {
    renderWithProviders(
      <DeploymentObservability builds={[]} startIndex={11} totalCount={28} />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getByText("Showing 0 of 28 deploys")).toBeInTheDocument();
  });

  it("ignores other keys and nested buttons on a history row", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b2/ });
    const escape = createEvent.keyDown(row, { key: "Escape" });
    fireEvent(row, escape);
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.keyDown(within(row).getByRole("button", { name: /DAST/ }), {
      key: "Enter",
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
