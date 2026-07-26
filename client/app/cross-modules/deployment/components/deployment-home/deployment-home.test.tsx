import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";

vi.mock("@blocks-deployment/services/providers.service", () => ({
  authenticateWithGithub: vi.fn(),
  authenticateWithGitlab: vi.fn(),
  authenticateWithBitbucket: vi.fn(),
  authenticateWithAzure: vi.fn(),
  authenticateWithAws: vi.fn(),
}));

import DeploymentInstruction from "./instruction";
import DeploymentOverview from "./deployment-overview";

describe("DeploymentInstruction", () => {
  it("renders the getting-started steps and opens the connect dialog", async () => {
    renderWithProviders(<DeploymentInstruction />);
    expect(screen.getByText("Deployment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start deployment/i }));
    expect(await screen.findByText("Connect repository")).toBeInTheDocument();
  });
});

describe("DeploymentOverview", () => {
  it("shows the no-repository state for an empty list", () => {
    renderWithProviders(
      <DeploymentOverview projects={[]} refetch={vi.fn()} />,
    );
    expect(screen.getByText("Deployment Overview")).toBeInTheDocument();
  });

  it("shows the error state when projects is undefined", () => {
    renderWithProviders(
      <DeploymentOverview
        projects={undefined as never}
        refetch={vi.fn()}
      />,
    );
    expect(screen.getByText("Deployment Overview")).toBeInTheDocument();
  });
});
