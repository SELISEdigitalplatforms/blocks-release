import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";

const navigateMock = vi.fn();
let params: Record<string, string | undefined> = { repoId: "r1", buildId: "b1" };

vi.mock("@/cross-modules/deployment/hooks/use-github-info", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/cross-modules/deployment/hooks/use-github-info")>();
  return { ...actual, useGetCardProjectAndBranch: vi.fn() };
});
vi.mock("@/cross-modules/deployment/hooks/use-observability", () => ({
  useGetSCALibraryData: () => ({ data: undefined, isLoading: false, error: null }),
  useSCARedirectLink: () => ({ isLoading: false, refetch: vi.fn() }),
  useGetSASTData: () => ({ data: undefined, isLoading: false, error: null }),
  useSASTRedirectLink: () => ({ isLoading: false, refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useParams: () => params,
    useNavigate: () => navigateMock,
  };
});

import DeploymentDetails from "./deployment-details";

describe("DeploymentDetails page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = { repoId: "r1", buildId: "b1" };
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: { data: { events: [], status: "Completed" }, isSuccess: true },
      isSuccess: true,
      isError: false,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as never);
  });

  it("renders the build id heading and tab navigation", () => {
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    expect(screen.getByRole("heading", { name: "b1" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Build details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "SCA" })).toBeInTheDocument();
  });

  it("switches report tabs by click and arrow keys", async () => {
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    await userEvent.click(screen.getByRole("tab", { name: "SCA" }));
    expect(screen.getByRole("tab", { name: "SCA" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "SCA" })).toBeInTheDocument();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "DAST" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "DAST" })).toBeInTheDocument();
  });

  it("describes the build under the title", () => {
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: {
        data: { events: [], status: "Completed", repoName: "org/web-app", branch: "main" },
        isSuccess: true,
      },
      isSuccess: true,
      isError: false,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-logs/b1",
    });
    expect(
      screen.getByText("Build of web-app on main · logs and security reports"),
    ).toBeInTheDocument();
  });

  it("navigates back when the back button is clicked", () => {
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("shows the loading state when there is no build id", () => {
    params = { repoId: "r1", buildId: undefined };
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1",
    });
    expect(screen.getByText("Loading deployment details...")).toBeInTheDocument();
  });

  it("redirects and toasts on a fatal fetch error", async () => {
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: undefined,
      isSuccess: false,
      isError: true,
      error: { errors: { data: null, isSuccess: false } },
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    const { toast } = await import("@/hooks/use-toast");
    expect(navigateMock).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
