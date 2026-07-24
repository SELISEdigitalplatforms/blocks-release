import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DeploymentObservability from "./deployment-observability";
import type { IPipeline } from "@blocks-deployment/pages/repo-details";

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
  it("renders the latest build view", () => {
    const { container } = renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the full history view", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} showAllHistory />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getAllByText(/SAST|SCA|DAST/i).length).toBeGreaterThan(0);
  });
});
