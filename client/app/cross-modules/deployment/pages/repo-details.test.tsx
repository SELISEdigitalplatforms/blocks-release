import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useDeleteDeployment,
  useGetRepoDetails,
  useInitialRepoDeployment,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { toast } from "@/hooks/use-toast";
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
    useDeleteDeployment: vi.fn(),
  };
});
vi.mock("@/cross-modules/deployment/hooks/use-alerts", () => ({
  useGetMonitorListById: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
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
  // Present means a live deployment: it is what the Delete control and the live URL key off.
  deployedNamespace: "acme-dev-app",
  lastDeploymentStatus: "Succeeded",
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

// The repo's branch is "main"; this build is on another branch. That combination is what
// the Details tab's single-item request makes dangerous, so it gets its own fixture.
const repoDetailsForeignBranch = {
  data: {
    repo: { ...baseRepo },
    build: [makeBuild({ branch: "some-other-branch", itemId: "foreign-1" })],
  },
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
    vi.mocked(useDeleteDeployment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
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

  it("renders a custom deployment url and cancels the manual deploy dialog", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: {
          repo: {
            ...baseRepo,
            customDeploymentUrl: "https://custom.example.com",
          },
          build: [makeBuild()],
        },
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
    expect(
      screen.getByText("https://custom.example.com"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.getByText("Deployment Information")).toBeInTheDocument();
  });

  it("switches tabs through the mobile select", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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
    await user.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "History" }));
    // tabChangedHandler updated the mocked query state.
    expect(currentTab).toBe("history");
  });

  it("offers the Secrets tab on both the desktop list and the mobile select", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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

    expect(screen.getByRole("tab", { name: "Secrets" })).toBeInTheDocument();

    // The mobile fallback is a separate hand-maintained list; without this a below-md user
    // could not reach the tab at all.
    await user.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Secrets" }));
    expect(currentTab).toBe("secrets");
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
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment"),
    );
  });

  it("deploys from the settings modal with no build id in the response", async () => {
    const initialDeploy = vi.fn((_vars, opts) => {
      opts.onSuccess({});
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
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    const deployButtons = await screen.findAllByRole("button", {
      name: /Deploy Now/i,
    });
    fireEvent.click(deployButtons[deployButtons.length - 1]);
    expect(initialDeploy).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment"),
    );
  });

  it("handles a settings-modal deployment error", async () => {
    const initialDeploy = vi.fn((_vars, opts) => {
      opts.onError({ errors: { message: "nope" } });
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
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    const deployButtons = await screen.findAllByRole("button", {
      name: /Deploy Now/i,
    });
    fireEvent.click(deployButtons[deployButtons.length - 1]);
    expect(initialDeploy).toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(deployMutate).toHaveBeenCalled();
  });

  it("renders the whole page of builds on the history tab", () => {
    const builds = [
      makeBuild({ itemId: "b1", createdDate: "2024-01-01T00:00:00Z" }),
      makeBuild({ itemId: "b2", createdDate: "2024-01-02T00:00:00Z" }),
      makeBuild({ itemId: "b3", createdDate: "2024-01-03T00:00:00Z" }),
      makeBuild({ itemId: "b4", createdDate: "2024-01-04T00:00:00Z" }),
    ];
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: { repo: { ...baseRepo }, build: builds, totalCount: 4 },
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

    // The old build was trimmed to three with a "View all history" toggle; a page is now
    // rendered whole, and the toggle is gone.
    expect(screen.getByText("Showing 1-4 of 4 deploys")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /View all history/i }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a pager when the whole history fits on one page", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: {
          repo: { ...baseRepo },
          build: [makeBuild({ itemId: "b1" })],
          totalCount: 1,
        },
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
    expect(screen.getByText("Showing 1-1 of 1 deploys")).toBeInTheDocument();
    expect(screen.queryByText(/Page 1 of/i)).not.toBeInTheDocument();
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

  describe("delete deployment", () => {
    const renderWithRepo = (repoOverrides = {}) => {
      vi.mocked(useGetRepoDetails).mockReturnValue({
        data: {
          data: { repo: { ...baseRepo, ...repoOverrides }, build: [makeBuild()] },
          isSuccess: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      } as never);
      return renderWithProviders(<RepoDetails />, {
        route: "/app/deployment/repo/r1?tab=details",
        nuqs: true,
      });
    };

    it("offers Delete when a deployment is live", () => {
      renderWithRepo();
      expect(
        screen.getByTestId("delete-deployment-button"),
      ).toBeInTheDocument();
    });

    it("hides Delete when no namespace is recorded", () => {
      // Never deployed, already deleted, or deployed before the namespace was captured -
      // in every case there is nothing this page can delete.
      renderWithRepo({ deployedNamespace: null });
      expect(
        screen.queryByTestId("delete-deployment-button"),
      ).not.toBeInTheDocument();
    });

    it("names the repository and URL in the modal and sends nothing until confirmed", () => {
      const deleteMutate = vi.fn();
      vi.mocked(useDeleteDeployment).mockReturnValue({
        mutate: deleteMutate,
        isPending: false,
      } as never);
      renderWithRepo();

      fireEvent.click(screen.getByTestId("delete-deployment-button"));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("Delete deployment?");
      // The user must be told exactly which repository and which URL they are destroying.
      expect(dialog).toHaveTextContent("app");
      expect(dialog).toHaveTextContent("https://app.dev");
      expect(dialog).toHaveTextContent("The site will stop responding");
      // Opening the dialog must not be enough to destroy anything.
      expect(deleteMutate).not.toHaveBeenCalled();
    });

    it("deletes the deployment for this repo once confirmed", () => {
      const deleteMutate = vi.fn((_repoId, opts) => {
        opts.onSuccess({ message: "Deployment deletion started." });
        opts.onSettled();
      });
      vi.mocked(useDeleteDeployment).mockReturnValue({
        mutate: deleteMutate,
        isPending: false,
      } as never);
      renderWithRepo();

      fireEvent.click(screen.getByTestId("delete-deployment-button"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(deleteMutate).toHaveBeenCalledWith("r1", expect.anything());
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("surfaces a failure instead of claiming the deployment is gone", () => {
      const deleteMutate = vi.fn((_repoId, opts) => {
        opts.onError({ errors: { message: "Forbidden (403)" } });
        opts.onSettled();
      });
      vi.mocked(useDeleteDeployment).mockReturnValue({
        mutate: deleteMutate,
        isPending: false,
      } as never);
      renderWithRepo();

      fireEvent.click(screen.getByTestId("delete-deployment-button"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Forbidden (403)",
        }),
      );
    });

    it("presents the repo as deleted once the namespace is cleared", () => {
      const { container } = renderWithRepo({
        deployedNamespace: null,
        lastDeploymentStatus: "Deleted",
      });

      // Status comes from the repo record, not the build that survived the deletion.
      const status = screen.getByTestId("deployment-status");
      expect(status).toHaveTextContent("Deleted");
      expect(status).not.toHaveTextContent("Succeeded");
      // The URL is still shown for reference but is no longer a live link.
      expect(screen.getByTestId("deploys-to-inactive")).toBeInTheDocument();
      expect(
        container.querySelector('a[href="https://app.dev"]'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("delete-deployment-button"),
      ).not.toBeInTheDocument();
    });
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

  // ─── Pagination (#175) ──────────────────────────────────────────────────────

  describe("build pagination", () => {
    const okResponse = {
      data: { repo: { ...baseRepo }, build: [makeBuild()] },
      isSuccess: true,
    };

    const lastCallOptions = () => {
      const calls = vi.mocked(useGetRepoDetails).mock.calls;
      return calls[calls.length - 1][1] as
        | { pageNumber?: number; pageSize?: number }
        | undefined;
    };

    // H3
    it("asks for a single build on the Details tab", () => {
      currentTab = "details";
      vi.mocked(useGetRepoDetails).mockReturnValue({
        data: okResponse,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      renderWithProviders(<RepoDetails />, {
        route: "/app/deployment/repo/r1?tab=details",
        nuqs: true,
      });

      expect(lastCallOptions()?.pageSize).toBe(1);
      expect(lastCallOptions()?.pageNumber).toBe(1);
    });

    // H4
    it("asks for five builds on the History tab", () => {
      currentTab = "history";
      vi.mocked(useGetRepoDetails).mockReturnValue({
        data: okResponse,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      renderWithProviders(<RepoDetails />, {
        route: "/app/deployment/repo/r1?tab=history",
        nuqs: true,
      });

      expect(lastCallOptions()?.pageSize).toBe(5);
      expect(lastCallOptions()?.pageNumber).toBe(1);
    });

    // The whole point of a five-row page: the pager has to ask the server for the next
    // one rather than slice a list it already holds.
    it("requests the next page from the server when the pager advances", async () => {
      currentTab = "history";
      vi.mocked(useGetRepoDetails).mockReturnValue({
        data: {
          data: {
            repo: { ...baseRepo },
            build: [makeBuild({ itemId: "b1" })],
            totalCount: 28,
          },
          isSuccess: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      renderWithProviders(<RepoDetails />, {
        route: "/app/deployment/repo/r1?tab=history",
        nuqs: true,
      });

      expect(lastCallOptions()?.pageNumber).toBe(1);

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));

      await waitFor(() => expect(lastCallOptions()?.pageNumber).toBe(2));
      expect(lastCallOptions()?.pageSize).toBe(5);
    });

    // C3b: the silent-blank case. With a single-item request, a build whose branch differs
    // from the repo's would be dropped by the page's branch filter, leaving the panel empty
    // while the empty state (which tests the raw response) never renders either. The latest
    // build is therefore taken from the raw, server-sorted response.
    it("still shows the newest build when its branch differs from the repo's", () => {
      currentTab = "details";
      vi.mocked(useGetRepoDetails).mockReturnValue({
        data: repoDetailsForeignBranch,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      renderWithProviders(<RepoDetails />, {
        route: "/app/deployment/repo/r1?tab=details",
        nuqs: true,
      });

      // This panel renders `latestBuild?.repoUrl || "N/A"`, so the URL appearing proves
      // latestBuild is populated. (Not asserting the absence of "N/A" anywhere on the
      // page - other fields legitimately render it, e.g. a null commit.) The probe that
      // reverts this derivation to the filtered list is what proves the assertion bites.
      expect(
        screen.getByText("https://github.com/acme/app"),
      ).toBeInTheDocument();
    });
  });
});
