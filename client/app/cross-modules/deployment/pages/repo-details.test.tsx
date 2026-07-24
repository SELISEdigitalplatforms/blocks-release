import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetRepoDetails,
  useInitialRepoDeployment,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { useGetMonitorListById } from "@/cross-modules/deployment/hooks/use-alerts";
import { useProjectStore } from "@/store/project.store";

const navigateMock = vi.fn();
let currentTab = "details";

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nuqs")>();
  return {
    ...actual,
    useQueryState: () => [currentTab, (v: string) => (currentTab = v)],
  };
});

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
  return {
    ...actual,
    useParams: () => ({ repoId: "r1" }),
    useNavigate: () => navigateMock,
  };
});

import RepoDetails from "./repo-details";

const baseRepo = {
  itemId: "r1",
  repoName: "acme/app",
  branch: "main",
  repoUrl: "https://github.com/acme/app",
  defaultDeploymentUrl: "https://app.dev",
  customDeploymentUrl: "",
  deploymentType: "auto",
  lastDeploymentDate: "2024-01-01T00:00:00Z",
  deploySettings: {},
};

const makeBuild = (overrides = {}) => ({
  blocksUserId: "u1",
  repoId: "r1",
  repoName: "acme/app",
  repoUrl: "https://github.com/acme/app",
  commit: null,
  branch: "main",
  imageName: "img",
  status: "Succeeded",
  eventName: "deploy",
  duration: 10,
  buildImageName: null,
  pipelineRunName: "run",
  html_url: null,
  events: [],
  itemId: "b1",
  createdDate: "2024-01-01T00:00:00Z",
  lastUpdatedDate: "2024-01-01T00:00:00Z",
  createdBy: null,
  language: null,
  lastUpdatedBy: null,
  organizationIds: [],
  tags: [],
  defaultDeploymentUrl: "https://app.dev",
  ...overrides,
});

const repoDetailsEmpty = {
  data: { repo: { ...baseRepo }, build: [] },
  isSuccess: true,
};

describe("RepoDetails page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    currentTab = "details";
    useProjectStore.getState().setSelectedProject({
      itemId: "p1",
      tenantId: "test-tenant-id-123",
      tenantGroupId: "test-tenant-group-id",
      name: "Test Project",
      applicationDomain: "https://test.seliseblocks.com",
      customDomain: "",
      isProduction: false,
      environment: "dev",
      tenantSlug: "test-project",
    });
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

  it("renders the empty deployment state and opens settings modal via Deploy Now", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: repoDetailsEmpty,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(screen.getByText("No deployments available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(screen.getByText("acme/app")).toBeInTheDocument();
  });

  it("goes back from the empty state", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: repoDetailsEmpty,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    // The first button in the empty state is the back control.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment"),
    );
  });

  it("deploys from the settings modal in the empty state", async () => {
    const initialDeploy = vi.fn((_vars, opts) => {
      opts.onSuccess({ buildId: "fresh" });
    });
    vi.mocked(useInitialRepoDeployment).mockReturnValue({
      mutate: initialDeploy,
      isPending: false,
    } as never);
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: repoDetailsEmpty,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    // Open the settings modal from the empty-state Deploy Now button.
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    // The modal renders its own Deploy Now button (deployment flow).
    const deployButtons = await screen.findAllByRole("button", {
      name: /Deploy Now/i,
    });
    fireEvent.click(deployButtons[deployButtons.length - 1]);
    expect(initialDeploy).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment-live/fresh"),
    );
  });

  it("renders deployment information when builds exist", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: [makeBuild()] },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    const { container } = renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(screen.getByText("Deployment Information")).toBeInTheDocument();
    expect(container.textContent).toContain("https://app.dev");
  });

  it("opens the confirmation modal and confirms a manual deployment", () => {
    const deployMutate = vi.fn((_vars, opts) => {
      opts.onSuccess({ buildId: "newbuild" });
    });
    vi.mocked(useInitialRepoDeployment).mockReturnValue({
      mutate: deployMutate,
      isPending: false,
    } as never);
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: [makeBuild()] },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Deploy/i }));
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(deployMutate).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment-live/newbuild"),
    );
  });

  it("consumes the refresh query param on mount", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        search: "?refresh=true",
        pathname: "/app/deployment/repo/r1",
      },
    });
    const replaceState = vi.spyOn(window.history, "replaceState");
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: [makeBuild()] },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(replaceState).toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("navigates to deployment home when a manual deploy returns no build id", () => {
    const deployMutate = vi.fn((_vars, opts) => {
      opts.onSuccess({});
    });
    vi.mocked(useInitialRepoDeployment).mockReturnValue({
      mutate: deployMutate,
      isPending: false,
    } as never);
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: [makeBuild()] },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Deploy/i }));
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment"),
    );
  });

  it("handles a manual deployment error", () => {
    const deployMutate = vi.fn((_vars, opts) => {
      opts.onError({ errors: { message: "boom" } });
      opts.onSettled?.();
    });
    vi.mocked(useInitialRepoDeployment).mockReturnValue({
      mutate: deployMutate,
      isPending: false,
    } as never);
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: [makeBuild()] },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Deploy/i }));
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(deployMutate).toHaveBeenCalled();
  });

  it("shows the history tab with a view-all toggle for many builds", () => {
    const builds = [
      makeBuild({ itemId: "b1", createdDate: "2024-01-01T00:00:00Z" }),
      makeBuild({ itemId: "b2", createdDate: "2024-01-02T00:00:00Z" }),
      makeBuild({ itemId: "b3", createdDate: "2024-01-03T00:00:00Z" }),
      makeBuild({ itemId: "b4", createdDate: "2024-01-04T00:00:00Z" }),
    ];
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: builds },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    currentTab = "history";
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=history",
      nuqs: true,
    });
    const viewAll = screen.getByRole("button", { name: /View all history/i });
    fireEvent.click(viewAll);
    expect(screen.getByText(/View Less/i)).toBeInTheDocument();
  });

  it("opens the configure settings modal from the header", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: [makeBuild()] },
        isSuccess: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Configure/i }));
    expect(screen.getByText("Deployment Information")).toBeInTheDocument();
  });

  it("navigates away when the repo cannot be resolved", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: {
        errors: { data: { repo: null }, isSuccess: false },
      },
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(navigateMock).toHaveBeenCalled();
  });

  it("shows the missing parameters view when no project is selected", () => {
    useProjectStore.getState().resetSelectedProject();
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: repoDetailsEmpty,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    renderWithProviders(<RepoDetails />, {
      route: "/app/deployment/repo/r1?tab=details",
      nuqs: true,
    });
    expect(
      screen.getByText(/Missing required parameters/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go Back" }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
