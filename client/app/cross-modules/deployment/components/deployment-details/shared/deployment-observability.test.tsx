import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DeploymentObservability from "./deployment-observability";
import type { IPipeline } from "@blocks-deployment/pages/repo-details";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
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
      <DeploymentObservability builds={builds} showAllHistory />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getAllByText(/SAST|SCA|DAST/i).length).toBeGreaterThan(0);
    const scaActions = screen.getAllByText("SCA");
    fireEvent.click(scaActions[0]);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=sca"),
    );
  });
});
