import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetRepoDetails,
  useInitialRepoDeployment,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { useGetMonitorListById } from "@/cross-modules/deployment/hooks/use-alerts";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/cross-modules/deployment/hooks/use-github-info")
    >();
  return {
    ...actual,
    useGetRepoDetails: vi.fn(),
    useInitialRepoDeployment: vi.fn(),
  };
});
vi.mock("@/cross-modules/deployment/hooks/use-alerts", () => ({
  useGetMonitorListById: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ repoId: "r1" }) };
});

import RepoDetails from "./repo-details";

const repoDetails = {
  data: {
    repo: {
      itemId: "r1",
      repoName: "acme/app",
      branch: "main",
      repoUrl: "https://github.com/acme/app",
      defaultDeploymentUrl: "https://app.dev",
      customDeploymentUrl: "",
      deploySettings: {},
    },
    build: [],
  },
  isSuccess: true,
};

describe("RepoDetails page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInitialRepoDeployment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useGetMonitorListById).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);
  });

  it("renders the loading spinner while fetching", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the repo details once loaded", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: repoDetails,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    const { container } = renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(container.textContent).toContain("acme/app");
  });
});
