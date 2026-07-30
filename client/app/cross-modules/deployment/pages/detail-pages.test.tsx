import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGetCardProjectAndBranch: vi.fn(),
  useGetSASTData: vi.fn(() => ({ data: undefined, isLoading: false })),
  useSASTRedirectLink: vi.fn(() => ({ isLoading: false, refetch: vi.fn() })),
  useGetSCALibraryData: vi.fn(() => ({ data: undefined, isLoading: false })),
  useSCARedirectLink: vi.fn(() => ({ isLoading: false, refetch: vi.fn() })),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

import DeploymentDetails from "./deployment-details";
import LiveLogs from "./live-logs";

const cardResult = {
  data: {
    data: {
      repoUrl: "https://github.com/acme/app",
      status: "Succeeded",
      createdDate: "2024-01-01T00:00:00Z",
      defaultDeploymentUrl: "https://app.dev",
      customDeploymentUrl: "",
    },
  },
  isSuccess: true,
  isError: false,
  error: null,
  isLoading: false,
  refetch: vi.fn(),
};

describe("deployment detail pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue(cardResult as never);
  });

  it("renders the DeploymentDetails page", () => {
    const { container } = renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-logs/b1",
    });
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the LiveLogs page", () => {
    renderWithProviders(<LiveLogs />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    expect(screen.getByText("General information")).toBeInTheDocument();
  });
});
